"""_asset_urls.py — resolve relative markdown image refs to their public Skool CDN url.

The Skool extractor rewrote CDN image urls to local paths and recorded the mapping in
`_raw/asset_url_to_local.json` (`cdn_url -> local_path`). We reverse it so lesson bodies
can reference the *public* CDN url directly (verified HTTP 200 without auth), keeping the
import 100% self-contained — no re-hosting, no base64 data-URI bloat. Consistent with the
"reference public urls, never re-host" decision that also governs the Loom/YouTube embeds.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=8)
def _reverse_map(data_root: str) -> dict[str, str]:
    """local_path -> cdn_url, loaded once per data-root (paths are posix-relative to root)."""
    raw = json.loads((Path(data_root) / "_raw" / "asset_url_to_local.json").read_text())
    return {local: cdn for cdn, local in raw.items()}


def resolve_asset_url(local_ref: str, md_path: Path, data_root: Path) -> str | None:
    """Resolve a relative markdown image ref (e.g. '../../../assets/skool/X.jpg') to the
    public CDN url. Returns None when the asset is not in the extractor map (caller decides
    — we never silently fabricate a url, § ALWAYS FAIL HARD)."""
    if local_ref.startswith(("http://", "https://", "data:")):
        return None  # already absolute — not our concern
    resolved = (md_path.parent / local_ref).resolve()
    try:
        rel = resolved.relative_to(Path(data_root).resolve()).as_posix()
    except ValueError:
        return None  # escaped the data-root — unexpected, leave as-is
    return _reverse_map(str(data_root)).get(rel)
