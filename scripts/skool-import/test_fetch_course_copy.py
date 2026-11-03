"""fetch_course_copy.py: a course folder of the TPB Drive lands whole in an empty local folder, each file checked."""
import hashlib
from pathlib import Path

import pytest

import fetch_course_copy as fetcher


class FakeDrive:
    def __init__(self, corrupt: str = "") -> None:
        self.folders = {"root": [("Cours", "cours")], "cours": [("course-a", "a")], "a": [("lessons", "l")], "l": []}
        self.bytes = {"a/readme.md": b"readme", "l/lesson-1.md": b"lesson one"}
        self.parents = {"a/readme.md": "a", "l/lesson-1.md": "l"}
        self.corrupt = corrupt

    def list_files(self, connection_id, parent_id=None):
        items = [{"id": fid, "name": name, "type": "FOLDER"} for name, fid in self.folders.get(parent_id, [])]
        for file_id, parent in self.parents.items():
            if parent == parent_id:
                data = self.bytes[file_id]
                items.append({"id": file_id, "name": file_id.rsplit("/", 1)[1], "type": "FILE", "size": len(data),
                              "hash": hashlib.md5(data).hexdigest()})
        return items

    def download_path(self, connection_id, file_id, path):
        Path(path).write_bytes(b"cut" if file_id == self.corrupt else self.bytes[file_id])


def test_fetches_the_course_folder_whole(tmp_path: Path) -> None:
    assert fetcher.fetch(FakeDrive(), "Cours/course-a", tmp_path / "copy") == 2
    assert (tmp_path / "copy/lessons/lesson-1.md").read_bytes() == b"lesson one"


def test_a_download_that_differs_is_refused(tmp_path: Path) -> None:
    with pytest.raises(fetcher.FetchRefused, match="differs"):
        fetcher.fetch(FakeDrive(corrupt="l/lesson-1.md"), "Cours/course-a", tmp_path / "copy")


def test_an_unknown_folder_is_refused(tmp_path: Path) -> None:
    with pytest.raises(fetcher.FetchRefused, match="0 folders"):
        fetcher.fetch(FakeDrive(), "Cours/nope", tmp_path / "copy")


def test_a_folder_that_is_not_empty_is_refused(tmp_path: Path) -> None:
    (tmp_path / "copy").mkdir()
    (tmp_path / "copy/x").write_text("x")
    with pytest.raises(fetcher.FetchRefused, match="not empty"):
        fetcher.fetch(FakeDrive(), "Cours/course-a", tmp_path / "copy")
