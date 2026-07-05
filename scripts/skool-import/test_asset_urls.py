"""Tests for _asset_urls — reverse-map resolution of relative image refs to CDN urls."""
import json
from pathlib import Path

from _asset_urls import resolve_asset_url, _reverse_map


def _seed(root: Path) -> None:
    (root / "_raw").mkdir(parents=True)
    (root / "_raw" / "asset_url_to_local.json").write_text(json.dumps({
        "https://assets.skool.com/f/abc/hash1-md.jpg": "assets/skool/local1.jpg",
        "https://assets.skool.com/f/def/hash2-md.jpg": "assets/skool/local2.jpg",
    }))


def test_reverse_map_inverts(tmp_path: Path) -> None:
    _seed(tmp_path)
    rev = _reverse_map(str(tmp_path))
    assert rev["assets/skool/local1.jpg"] == "https://assets.skool.com/f/abc/hash1-md.jpg"


def test_resolve_relative_ref_from_lesson(tmp_path: Path) -> None:
    _seed(tmp_path)
    md = tmp_path / "classroom" / "01_course" / "01_section" / "01_lesson.md"
    # '../../../assets/…' from the lesson dir climbs to data-root/assets/…
    url = resolve_asset_url("../../../assets/skool/local1.jpg", md, tmp_path)
    assert url == "https://assets.skool.com/f/abc/hash1-md.jpg"


def test_absolute_and_data_uri_are_ignored(tmp_path: Path) -> None:
    _seed(tmp_path)
    md = tmp_path / "classroom" / "01_course" / "01_section" / "01_lesson.md"
    assert resolve_asset_url("https://x.com/a.jpg", md, tmp_path) is None
    assert resolve_asset_url("data:image/png;base64,AAA", md, tmp_path) is None


def test_unmapped_ref_returns_none(tmp_path: Path) -> None:
    _seed(tmp_path)
    md = tmp_path / "classroom" / "01_course" / "01_section" / "01_lesson.md"
    assert resolve_asset_url("../../../assets/skool/missing.jpg", md, tmp_path) is None
