# 21 — Course 1 (Vision & Context): add « Who We Serve & How We Win » + « The Founder's Story »

## Contexte

Course `course_mc_1` "1 — Vision & Context" has ONE section today:
`("sec_mc_1_1", "Vision & Context", [c1-1 the-vision, c1-2 how-companies-go-to-market, c1-3 one-offer-five-products])`.

We ADD two sections folding the substantial Notion PACE-R "Purpose" content not yet in the LMS:
- **Who We Serve & How We Win** ← Notion `1.2 Target market.md` (987w) + `1.3 Positioning.md` (1551w).
- **The Founder's Story** ← Notion `1.4 Founder's narrative.md` (1289w).

Notion source dir (constat 2026-07-06, files exist, word counts per 20): `Brain/the-play-button/pb05-lead-sales-training-program/inputs/TPB Notion/TPB Sales On-Boarding/Master class/`.

House voice = skill `marketing/content/copywriting/` + `reference/writing-a-course.md`: 2nd person,
open on substance, keep concrete market/positioning facts + numbers, do/don't tables where useful,
zero em/en-dash, zero "in this lesson", zero source citation.

Manifest today (`import_masterclass.py` COURSES, course_mc_1 block) is the single-section tuple above.
Importer adds sections by appending tuples; `sysOrderIndex` = list order.

## Fichiers impactés

- CREATE `plans/2026-07-05_tpb-sales-masterclass-3.0-fresh/_content/c1-4-who-we-serve.md` (from Notion 1.2)
- CREATE `.../_content/c1-5-how-we-position.md` (from Notion 1.3)
- CREATE `.../_content/c1-6-the-founders-story.md` (from Notion 1.4)
- MODIFY `Apps/the-play-button/tpb-lms/scripts/masterclass-import/import_masterclass.py` (course_mc_1 block: add 2 section tuples)

## Étapes

1. Read Notion `1.2 Target market.md` → author `c1-4-who-we-serve.md` (the market we serve, the ICP
   at a high level, why this market). House voice.
2. Read Notion `1.3 Positioning.md` → author `c1-5-how-we-position.md` (positioning, the wedge,
   under-promise/over-deliver doctrine). House voice.
3. Read Notion `1.4 Founder's narrative.md` → author `c1-6-the-founders-story.md`. House voice.
4. In `import_masterclass.py`, inside the `course_mc_1` tuple, after `sec_mc_1_1`, append:
   ```python
   ("sec_mc_1_2", "Who We Serve & How We Win", [
       ("les_mc_1_2_1", "Who We Serve", CONTENT / "c1-4-who-we-serve.md"),
       ("les_mc_1_2_2", "How We Position", CONTENT / "c1-5-how-we-position.md"),
   ]),
   ("sec_mc_1_3", "The Founder's Story", [
       ("les_mc_1_3_1", "The Founder's Story", CONTENT / "c1-6-the-founders-story.md"),
   ]),
   ```
5. `python3 scripts/masterclass-import/import_masterclass.py` → expect `errors 0`.
6. Live verify in tpb-browser on `course_mc_1`: 3 sections in sidebar, new lessons render, tables OK,
   grep body for em/en-dash + "hormozi" + "in this lesson" = none, 0 console error.
7. Write `21-...plan.done.md` with evidence.

## Risques identifiés

- Notion 1.x may overlap with c1-1 vision. Mitigation: c1-4/c1-5 cover MARKET + POSITIONING (distinct
  from the vision lesson); if a true dup surfaces, fold into one lesson, never ship two (§ BIG BANG).
- Founder narrative may contain dated/PII specifics. Mitigation: keep it about the mission arc, drop
  anything stale; talk to the reader.

## Critères de validation

- `course_mc_1` shows 3 sections; 3 new lessons reachable and rendered.
- `import_masterclass.py` errors 0.
- Zero em/en-dash, zero citation, 0 console error on the 3 new lessons (tpb-browser).
- c1-1/c1-2/c1-3 still present and unchanged.
