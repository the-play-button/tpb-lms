#!/usr/bin/env python3
"""Fetch a course copy from the TPB Drive into an empty local folder, each file checked by its size and md5.

The course copies left CORSAIR for the TPB Drive (sub-05 plan 13, 2026-11-03), under `Cours/` (see README). The import
scripts read a local folder (`--data-root`): fetch one first. Acts as the `tpb login` human through `StorageClient`.

Usage: fetch_course_copy.py --folder "Cours/pa02-resources/Nick Saraev - Maker School" --dest <empty-folder>
"""
from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path
from typing import Iterator, Protocol

CONNECTION = "conn_googledrive_e60bd652d19"
ORGANIZATION = "org_tpb"
ENVIRONMENT = "production"
FOLDER = "FOLDER"


class DriveClient(Protocol):
    """What this script needs of `tpb_sdk.storage.client.StorageClient`."""

    def list_files(self, connection_id: str, parent_id: str | None = None) -> list[dict]: ...

    def download_path(self, connection_id: str, file_id: str, path: Path) -> object: ...


class FetchRefused(RuntimeError):
    """The Drive does not hold the folder, or a download differs from what the Drive reports."""


def resolve_folder(client: DriveClient, folder: str) -> str:
    current = "root"
    for name in folder.strip("/").split("/"):
        found = [i for i in client.list_files(CONNECTION, parent_id=current) if i["name"] == name and i.get("type") == FOLDER]
        if len(found) != 1:
            raise FetchRefused(f"{folder}: {len(found)} folders named {name!r} on the Drive")
        current = found[0]["id"]
    return current


def walk(client: DriveClient, folder_id: str, prefix: str = "") -> Iterator[tuple[str, dict]]:
    for item in client.list_files(CONNECTION, parent_id=folder_id):
        relative = f"{prefix}/{item['name']}" if prefix else item["name"]
        if item.get("type") == FOLDER:
            yield from walk(client, item["id"], relative)
        else:
            yield relative, item


def file_md5(path: Path) -> str:
    digest = hashlib.md5()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(4 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fetch(client: DriveClient, folder: str, destination: Path) -> int:
    if destination.exists() and any(destination.iterdir()):
        raise FetchRefused(f"{destination} is not empty")
    count = 0
    for relative, item in walk(client, resolve_folder(client, folder)):
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        client.download_path(CONNECTION, item["id"], target)
        if target.stat().st_size != int(item.get("size") or 0) or file_md5(target) != item.get("hash"):
            raise FetchRefused(f"{target} differs from what the Drive reports")
        count += 1
    return count


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--folder", required=True, help="the course folder on the TPB Drive, from its root (Cours/...)")
    parser.add_argument("--dest", required=True, type=Path, help="an empty local folder that receives the copy")
    args = parser.parse_args(argv)
    from tpb_sdk.storage.client import StorageClient

    client = StorageClient.from_identity(ENVIRONMENT, organization_id=ORGANIZATION)
    try:
        print(f"fetched {fetch(client, args.folder, args.dest)} files")
    except FetchRefused as exc:
        print(f"REFUSED: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
