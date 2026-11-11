#!/usr/bin/env python3
"""Receive one qualified npm artifact through the canonical generated release job."""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tarfile

REGISTRY = 'https://npm.tpb.sh/api/packages/the-play-button/npm/'
GENERATED_DIRECTORIES = frozenset(('node_modules', 'dist', 'build', 'coverage', '.next', '.turbo', 'artifacts', '__pycache__'))
VERSION_PATTERN = re.compile(
    r'(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)'
    r'(?:-(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)'
    r'(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?'
    r'(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?'
)


def run(arguments: list[str], directory: Path) -> str:
    return subprocess.check_output(arguments, cwd=directory, text=True)


def package_contract(root: Path, relative: str, prefix: str) -> tuple[Path, dict]:
    if Path(relative).is_absolute() or '..' in Path(relative).parts or not re.fullmatch(r'[A-Za-z0-9_./-]+', relative):
        raise ValueError('NPM_RELEASE_INVALID_PACKAGE_PATH')
    package = (root / relative).resolve()
    if not package.is_relative_to(root.resolve()):
        raise ValueError('NPM_RELEASE_PACKAGE_ESCAPES_CHECKOUT')
    manifest = json.loads((package / 'package.json').read_text())
    if manifest.get('private') is True:
        raise ValueError('NPM_RELEASE_PRIVATE_PACKAGE')
    if not re.fullmatch(r'@the-play-button/[a-z0-9][a-z0-9._-]*', manifest.get('name', '')):
        raise ValueError('NPM_RELEASE_FOREIGN_PACKAGE')
    if manifest['name'].split('/')[1] != prefix:
        raise ValueError('NPM_RELEASE_TAG_IDENTITY_MISMATCH')
    if manifest.get('publishConfig', {}).get('registry') != REGISTRY:
        raise ValueError('NPM_RELEASE_OWNED_REGISTRY_REQUIRED')
    version = manifest.get('version')
    if not isinstance(version, str) or VERSION_PATTERN.fullmatch(version) is None:
        raise ValueError('NPM_RELEASE_INVALID_VERSION')
    return package, manifest


def published_source(root: Path, package: Path, manifest: dict, prefix: str) -> dict:
    """Admit the exact published commit; the Git-only trigger never packages local outputs."""
    run(['git', 'fetch', '--no-tags', 'origin', 'main'], root)
    commit = run(['git', 'rev-parse', 'HEAD'], root).strip()
    if not re.fullmatch(r'[a-f0-9]{40}', commit):
        raise ValueError('NPM_RELEASE_SOURCE_IDENTITY_MISMATCH')
    subprocess.run(['git', 'merge-base', '--is-ancestor', commit, 'origin/main'], cwd=root, check=True)
    subprocess.run(['git', '-c', 'core.filemode=true', 'diff', '--exit-code', 'HEAD', '--'], cwd=root, check=True)
    untracked = run(['git', 'ls-files', '--others', '--exclude-standard', '-z'], root)
    if untracked:
        raise ValueError('NPM_RELEASE_UNTRACKED_SOURCE')
    return {'sourceCommit': commit, 'tag': prefix + '-v' + manifest['version'], 'name': manifest['name'], 'version': manifest['version'], 'packagePath': package.relative_to(root).as_posix(), 'registry': REGISTRY}


def verify_ignored_build_inputs(root: Path) -> None:
    """CI alone builds from the tagged commit; reject unknown ignored build inputs there."""
    ignored = run(['git', 'ls-files', '--others', '--ignored', '--exclude-standard', '-z'], root)
    for name in filter(None, ignored.split('\0')):
        # ls-files reports files: only an ancestor directory classifies an output.
        if not GENERATED_DIRECTORIES.intersection(Path(name).parts[:-1]):
            raise ValueError('NPM_RELEASE_UNCLASSIFIED_OUTPUT: ' + name)


def verify_source(root: Path, relative: str, prefix: str) -> dict:
    package, manifest = package_contract(root, relative, prefix)
    reference = os.environ.get('GITHUB_REF', '')
    if reference != 'refs/tags/' + prefix + '-v' + manifest['version']:
        raise ValueError('NPM_RELEASE_IMMUTABLE_TAG_REQUIRED')
    source = published_source(root, package, manifest, prefix)
    verify_ignored_build_inputs(root)
    selected = run(['git', 'rev-parse', reference + '^{commit}'], root).strip()
    event_commit = run(['git', 'rev-parse', os.environ['GITHUB_SHA'] + '^{commit}'], root).strip()
    if source['sourceCommit'] != selected or source['sourceCommit'] != event_commit:
        raise ValueError('NPM_RELEASE_SOURCE_IDENTITY_MISMATCH')
    return source


def remote_tag_commit(root: Path, reference: str) -> str | None:
    """An annotated tag's peeled commit, or a lightweight tag's exact target."""
    rows = run(['git', 'ls-remote', 'origin', reference, reference + '^{}'], root)
    targets = {}
    for line in rows.splitlines():
        commit, name = line.split('\t')
        if name not in (reference, reference + '^{}') or name in targets or not re.fullmatch(r'[a-f0-9]{40}', commit):
            raise ValueError('NPM_RELEASE_INVALID_REMOTE_TAG_RECEIPT')
        targets[name] = commit
    return targets[reference + '^{}'] if reference + '^{}' in targets else targets.get(reference)


def trigger_tag(root: Path, relative: str, prefix: str) -> dict:
    """Push only the immutable trigger; CI alone qualifies and publishes package bytes."""
    package, manifest = package_contract(root, relative, prefix)
    if run(['git', 'branch', '--show-current'], root).strip() != 'main':
        raise ValueError('NPM_RELEASE_MAIN_BRANCH_REQUIRED')
    source = published_source(root, package, manifest, prefix)
    reference = 'refs/tags/' + source['tag']
    present = subprocess.run(['git', 'show-ref', '--verify', '--quiet', reference], cwd=root)
    if present.returncode not in (0, 1):
        present.check_returncode()
    if present.returncode == 0:
        local = run(['git', 'rev-parse', reference + '^{commit}'], root).strip()
        if local != source['sourceCommit']:
            raise ValueError('NPM_RELEASE_TAG_SOURCE_CONFLICT: local tag ' + source['tag'])
    remote = remote_tag_commit(root, reference)
    if remote is not None:
        if remote != source['sourceCommit']:
            raise ValueError('NPM_RELEASE_TAG_SOURCE_CONFLICT: remote tag ' + source['tag'])
        return {**source, 'tagPushed': False}
    if present.returncode == 1:
        subprocess.run(['git', 'tag', '-a', source['tag'], source['sourceCommit'], '-m',
                        'Release ' + source['name'] + '@' + source['version']], cwd=root, check=True)
    subprocess.run(['git', 'push', 'origin', reference], cwd=root, check=True)
    if remote_tag_commit(root, reference) != source['sourceCommit']:
        raise ValueError('NPM_RELEASE_REMOTE_TAG_NOT_RECEIVED')
    return {**source, 'tagPushed': True}


def integrity(path: Path) -> str:
    with path.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha512').digest()
    return 'sha512-' + base64.b64encode(digest).decode('ascii')


def pack_archive(package: Path, directory: Path, *, identity: str | None = None) -> Path:
    """Keep npm lifecycle output visible; the one actual archive is the receipt authority.

    A local package's prepare runs here, explicitly, and its failure fails the pack : npm 10 ran it even with
    --ignore-scripts, npm 11 honours the flag (a pack without its build, 2026-11-05). A package read back from the
    registry has no source to prepare. Do not strip lifecycle output or hide warnings in background scripts.
    Keep all npm output on stderr and derive structured metadata from the tarball.
    """
    manifest = json.loads((package / 'package.json').read_text())
    if identity is None:
        subprocess.run(['npm', 'run', 'prepare', '--if-present', '--foreground-scripts=true'], cwd=package, stdout=sys.stderr, check=True)
    arguments = ['npm', 'pack', *([identity] if identity is not None else []),
                 '--ignore-scripts', '--foreground-scripts=true', '--pack-destination', str(directory)]
    if identity is not None:
        arguments.extend(['--registry', REGISTRY])
    subprocess.run(arguments, cwd=package, stdout=sys.stderr, check=True)
    expected = manifest['name'].removeprefix('@').replace('/', '-') + '-' + manifest['version'] + '.tgz'
    archives = list(directory.glob('*.tgz'))
    if len(archives) != 1 or archives[0].name != expected or archives[0].is_symlink() or not archives[0].is_file():
        raise ValueError('NPM_RELEASE_EXACT_ARCHIVE_REQUIRED')
    return archives[0]


def verify_archive(root: Path, package: Path, archive: Path) -> tuple[Path, str]:
    manifest = json.loads((package / 'package.json').read_text())
    observed = integrity(archive)
    files = []
    with tarfile.open(archive, 'r:gz') as stream:
        for member in stream.getmembers():
            if not member.name.startswith('package/') or '..' in Path(member.name).parts or not (member.isdir() or member.isfile()):
                raise ValueError('NPM_RELEASE_UNSAFE_ARCHIVE_MEMBER')
            if member.isfile():
                files.append({'path': member.name.removeprefix('package/'), 'size': member.size})
        packed_manifest = stream.extractfile('package/package.json')
        if packed_manifest is None or json.load(packed_manifest) != manifest:
            raise ValueError('NPM_RELEASE_ARCHIVE_MANIFEST_MISMATCH')
    receipt = [{'name': manifest['name'], 'version': manifest['version'], 'filename': archive.name,
                'integrity': observed, 'files': files, 'entryCount': len(files)}]
    receipt_path = archive.parent / 'pack-receipt.json'
    receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')
    subprocess.run(['node', str(root / 'scripts/verify-npm-package-artifact.mjs'), str(package / 'package.json'), str(receipt_path)], cwd=root, stdout=sys.stderr, check=True)
    return archive, observed


def artifact_directory(prefix: str) -> Path:
    if not re.fullmatch(r'[a-z0-9][a-z0-9._-]*', prefix):
        raise ValueError('NPM_RELEASE_INVALID_PREFIX')
    return Path(os.environ['RUNNER_TEMP']).resolve() / ('tpb-npm-release-' + prefix)


def execute(operation: str, root: Path, relative: str, prefix: str) -> dict:
    if operation == 'tag':
        return trigger_tag(root, relative, prefix)
    if operation not in ("verify-source", "qualify", "publish", "receive"):
        raise ValueError("NPM_RELEASE_UNKNOWN_OPERATION")
    source = verify_source(root, relative, prefix)
    if operation == 'verify-source':
        return source
    package, _ = package_contract(root, relative, prefix)
    directory = artifact_directory(prefix)
    proof_path = directory / 'qualified-artifact.json'
    if operation == 'qualify':
        directory.mkdir(mode=0o700)
        archive, fingerprint = verify_archive(root, package, pack_archive(package, directory))
        result = {**source, 'tarball': str(archive), 'integrity': fingerprint}
        proof_path.write_text(json.dumps(result, indent=2) + '\n')
        return result
    proof = json.loads(proof_path.read_text())
    if any(proof.get(name) != value for name, value in source.items()):
        raise ValueError('NPM_RELEASE_QUALIFIED_SOURCE_CHANGED')
    archive = Path(proof['tarball'])
    if archive.parent != directory or integrity(archive) != proof['integrity']:
        raise ValueError('NPM_RELEASE_QUALIFIED_ARTIFACT_CHANGED')
    if operation == 'publish':
        subprocess.run(['npm', 'publish', str(archive), '--ignore-scripts', '--registry', REGISTRY], cwd=package, check=True)
        return {**proof, 'registryMutationAdmitted': True}
    received = directory / 'registry-reception'
    received.mkdir(mode=0o700)
    _, fingerprint = verify_archive(root, package, pack_archive(package, received, identity=source['name'] + '@' + source['version']))
    if fingerprint != proof['integrity']:
        raise ValueError('NPM_RELEASE_REGISTRY_ARTIFACT_DIFFERS')
    result = {**proof, 'registryArtifactReceived': True}
    (directory / 'registry-receipt.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=('tag', 'verify-source', 'qualify', 'publish', 'receive'), help='Push the immutable CI trigger, verify source, qualify one archive, publish its exact bytes, or receive them from the registry.')
    parser.add_argument('--package-path', required=True, help='Package directory relative to the immutable repository checkout.')
    parser.add_argument('--tag-prefix', required=True, help='Canonical package name without its npm scope, before the version suffix.')
    arguments = parser.parse_args()
    print(json.dumps(execute(arguments.operation, Path.cwd(), arguments.package_path, arguments.tag_prefix)))


if __name__ == '__main__':
    main()
