# skool-import — upload a Skool classroom into tpb-lms (100% API, self-contained)

Uploads extracted Skool courses (`Brain/…/<Author> - <School>/`) into tpb-lms **entirely
via the LMS API** — no external content push, no re-hosting.

## Architecture — self-contained, zero re-host

| Content | Source | Where it lives |
|---|---|---|
| Structure (course / section / lesson) | `_raw/course_trees.json` (course → set → module) | tpb-lms D1 (via API) |
| Lesson text | `classroom/**/*.md` (extractor header stripped) | inline `content_md` (D1), rendered inline by the viewer |
| Videos (Loom + YouTube) | tree `videoLink` | direct embed (public url, hexagonal VideoProvider) |
| Course cover | `course.coverImage` | public Skool CDN url (media IMAGE) |
| Body images | `_raw/asset_url_to_local.json` reverse-map | **public Skool CDN url** (media in markdown) |

Consistent with the "reference public urls, never re-host" decision that also governs the
Loom/YouTube embeds. Skool CDN verified public (HTTP 200 without auth) on covers + body images.

## Files

- `_asset_urls.py` — reverse `asset_url_to_local.json` (local path → public CDN url).
- `import_course.py` — one course: strip md header, rewrite images → CDN url, classify
  video, **slug-match** sections/lessons to disk (order fallback), upsert (POST create +
  PATCH refresh = idempotent) with throttle + retry. Importable `import_one_course(...)`.
- `import_all.py` — batch over all courses (skips empty), aggregate report table.
- `test_asset_urls.py` — pytest for the reverse-map resolution.

## Auth

`app_lms` service-token PAT (vault `tpb/apps/lms/bastion_token`, carries `lms:*` → resolves
`lms:course:write` / `lms:class:write` via prefix-wildcard hasScope, SDK ≥ 15.17). CF Access
SA + Bearer via `BastionClient.from_devcontainer()`. Run from the workspace root (or any dir
where `.devcontainer/.env` resolves).

## Usage

```bash
DATA="/…/Nick Saraev - Maker School"

# validate everything without touching the API
python3 import_all.py --data-root "$DATA" --dry-run

# one course (idempotent)
python3 import_all.py --data-root "$DATA" --only ab5cf4d1

# a cohort
python3 import_all.py --data-root "$DATA" --only 167a7888 --only 3dda44a2

# resume from a course (tree order), skip one, slower throttle
python3 import_all.py --data-root "$DATA" --from 9376603b --skip 2d7de359 --sleep-ms 100
```

Ids are deterministic (`course_<skoolid>` / `sec_<setid>` / `les_<moduleid>`), so re-runs
never duplicate — POST is `INSERT OR IGNORE`, PATCH refreshes fields.

## Idempotence & robustness

- **Slug matching** aligns tree sets/modules to disk dirs/files (robust to an extra
  course-level `about` dir with no tree set); falls back to positional order and logs it.
- **Images** unmapped by the reverse-map are left as-is with a visible WARNING (never
  silently dropped). The full sweep prints `img cdn` / `img unmapped` counts per course.
- **Throttle + retry** (2×) on transient errors; `--sleep-ms` between writes.
