#!/usr/bin/env bash
# Install Python requirements so that every TPB package resolves ONLY from the TPB Forgejo PyPI.
#
# Usage: FORGEJO_PYPI_TOKEN=… bash scripts/install_from_org_pypi.sh <python> <pip install arguments…>
#
# Why (2026-10-31): the workflows ran `pip install --index-url <org> --extra-index-url https://pypi.org/simple/`.
# pip takes the highest version across ALL indexes, so a same-named package on pypi.org (tpb-sdk 99.0) would have been
# installed and run in CI, with the deploy job's BASTION_TOKEN in reach. Proven with a local index: pip installed
# pypi.org's six 1.17.0 over the org's six 0.0.1. uv with `--index-strategy first-index` and the org index first never
# looks a name up past the first index that has it; public dependencies still come from pypi.org.
#
# The org listing is read page by page: the former `limit=50` read only the first page (one entry per version), so
# tpb-entropy, on page 2, was looked up on pypi.org only.
#
# Forgejo lists files on its ROOT_URL (git.theplaybutton.ai, behind CF Access): each wheel link is rewritten to
# npm.tpb.sh, its #sha256 kept (the installer still verifies every file). The token stays in the process environment:
# urllib authenticates the index in memory and uv asks a host-scoped keyring subprocess for the download credential.
#
# Vendored byte-identical from tpb-devops/scripts (the generator's deploy kit).
set -euo pipefail

[ $# -ge 2 ] || { echo "usage: $0 <python> <pip install arguments…>" >&2; exit 2; }
: "${FORGEJO_PYPI_TOKEN:?FORGEJO_PYPI_TOKEN is required to read the TPB Forgejo PyPI}"
PYTHON="$1"; shift
UV_VERSION="0.13.6"
ROOT="$(mktemp -d)"; trap 'rm -rf "$ROOT"' EXIT
umask 077
"$PYTHON" - "$ROOT" <<'TPB_ORG_INDEX_PYTHON'
import base64
from html import escape
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urljoin, urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

registry_host = 'npm.tpb.sh'
registry_origin = 'https://' + registry_host
distribution_suffixes = ('.whl', '.tar.gz', '.tar.bz2', '.tar.xz', '.tgz', '.zip')
api = registry_origin + '/api/v1/packages/the-play-button'
simple = registry_origin + '/api/packages/the-play-button/pypi/simple/'
root = Path(sys.argv[1])
(root / 'org').mkdir()
(root / 'bin').mkdir()
credential = base64.b64encode(('token:' + os.environ['FORGEJO_PYPI_TOKEN']).encode()).decode()

class RegistryRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        target = urlsplit(new_url)
        if target.scheme != 'https' or target.netloc != registry_host:
            raise RuntimeError('REGISTRY_CREDENTIAL_REDIRECT_REFUSED')
        return super().redirect_request(request, response, code, message, headers, new_url)

opener = build_opener(RegistryRedirectHandler())
def read(url):
    with opener.open(Request(url, headers={'Authorization': 'Basic ' + credential}), timeout=30) as response:
        return response.read().decode('utf-8')

names = set()
for page in range(1, 1001):
    entries = json.loads(read(api + '?type=pypi&limit=50&page=' + str(page)))
    if not isinstance(entries, list):
        raise RuntimeError('REGISTRY_PACKAGE_LIST_REQUIRED')
    if not entries:
        break
    for entry in entries:
        name = entry['name']
        if not isinstance(name, str) or re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]*', name) is None:
            raise RuntimeError('REGISTRY_PACKAGE_NAME_INVALID')
        names.add(re.sub(r'[-_.]+', '-', name).lower())
else:
    raise RuntimeError('REGISTRY_PACKAGE_PAGINATION_LIMIT_REACHED')
if not names:
    raise RuntimeError('EMPTY_PRIVATE_REGISTRY_REFUSE_PUBLIC_ONLY_INSTALL')

class PackageLinks(HTMLParser):
    def __init__(self, package_url):
        super().__init__()
        self.package_url = package_url
        self.links = []
        self.metadata_links = 0

    def handle_starttag(self, tag, attributes):
        if tag != 'a':
            return
        href = dict(attributes).get('href')
        if href is None:
            self.metadata_links += 1
            return
        target = urlsplit(urljoin(self.package_url, href))
        # PEP 503 permits other HTML elements, including non-download anchors.
        # Cloudflare AI Labyrinth adds one at /cdn-cgi/content. Classify files
        # before checking their provenance; hidden/external distributions still fail.
        if not unquote(target.path).lower().endswith(distribution_suffixes):
            self.metadata_links += 1
            return
        if (target.scheme != 'https' or target.hostname not in ('git.theplaybutton.ai', registry_host)
                or target.username or target.password or target.port is not None
                or not target.path.startswith('/api/packages/the-play-button/pypi/files/')):
            raise RuntimeError('REGISTRY_PACKAGE_DOWNLOAD_ORIGIN_REFUSED')
        if re.fullmatch(r'sha256=[0-9a-fA-F]{64}', target.fragment) is None:
            raise RuntimeError('REGISTRY_PACKAGE_SHA256_REQUIRED')
        metadata = [(name, value) for name, value in attributes if name.startswith('data-')]
        self.links.append((urlunsplit(('https', 'token@' + registry_host, target.path, target.query, target.fragment)), metadata))

for name in sorted(names):
    package_url = simple + name + '/'
    parser = PackageLinks(package_url)
    parser.feed(read(package_url))
    if not parser.links:
        raise RuntimeError('REGISTRY_PACKAGE_DOWNLOADS_REQUIRED')
    if parser.metadata_links:
        print('PyPI index ' + name + ': non-distribution anchors=' + str(parser.metadata_links))
    destination = root / 'org' / name
    destination.mkdir()
    links = []
    for link, metadata in parser.links:
        attributes = ''.join(' ' + escape(name, quote=True) +
                             ('' if value is None else '="' + escape(value, quote=True) + '"')
                             for name, value in metadata)
        links.append('<a href="' + escape(link, quote=True) + '"' + attributes + '>' +
                     escape(urlsplit(link).path.rsplit('/', 1)[-1]) + '</a>')
    (destination / 'index.html').write_text('<!DOCTYPE html>\n<html><body>\n' + '\n'.join(links) + '\n</body></html>\n')

# The helper source contains only the environment-variable name; the credential is
# emitted solely to uv's private pipe for this exact host and username.
helper = root / 'bin' / 'keyring'
helper.write_text('''#!/usr/bin/env python3
import os
import sys
from urllib.parse import urlsplit
if len(sys.argv) != 4 or sys.argv[1] != 'get' or sys.argv[3] != 'token':
    raise SystemExit(1)
service = sys.argv[2]
if service != 'npm.tpb.sh':
    target = urlsplit(service)
    if target.scheme != 'https' or target.netloc != 'npm.tpb.sh':
        raise SystemExit(1)
value = os.environ.get('FORGEJO_PYPI_TOKEN')
if not value:
    raise SystemExit(1)
sys.stdout.write(value + '\\n')
''')
helper.chmod(0o700)
print('TPB packages resolved from the org index only: ' + ' '.join(sorted(names)))
TPB_ORG_INDEX_PYTHON

"$PYTHON" -m pip install --quiet "uv==${UV_VERSION}"
PATH="$ROOT/bin:$PATH" "$PYTHON" -m uv pip install --python "$PYTHON" --quiet \
  --keyring-provider subprocess \
  --index-strategy first-index \
  --index "file://$ROOT/org/" \
  --default-index https://pypi.org/simple/ \
  "$@"
