# 25 — Course 4 (The Offer): add « First ICP: External SDR Agency » section

## Contexte

Course `course_mc_4` "4 — The Offer" gets a SECOND added section (after 24's Product & Ecosystem):
the External SDR Agency ICP deep-dive from Notion section 6, absent from the LMS. This is the most
practical, insider-language content the user built:
- `6.1 SDR Lexicon.md` (1018w) — agency structure/roles, metrics/KPIs vocabulary.
- `6.2 Pain points.md` (1126w)
- `6.3 Buying triggers.md` (800w)
- `6.4 Objections.md` (1607w)
- `6.0 How to find them?.md` (20w stub) → fold as a short closing block, not its own lesson.

The course already has `c4-2 Who We Sell To: ICP, Triggers, Buckets` (high-level). This section is the
DEEP version for the first ICP. Read c4-2 first to avoid duplication; c4-2 stays the overview, this
section is the drill-down (§ BIG BANG — one overview + one deep, not two overlapping overviews).

House voice = copywriting skill. Keep the lexicon tables (insider terms) and objection scripts
verbatim-useful. Zero em/en-dash, zero citation.

Depends on 24 being applied first (same course block; append after `sec_mc_4_2`).

## Fichiers impactés

- READ (dedup): `_content/c4-2-who-we-sell-to.md`
- CREATE `.../_content/c4i-1-the-agency-world.md` (from 6.1 lexicon: structure, roles, metrics)
- CREATE `.../_content/c4i-2-their-pain.md` (from 6.2)
- CREATE `.../_content/c4i-3-buying-triggers.md` (from 6.3 + fold 6.0 how-to-find as a closing block)
- CREATE `.../_content/c4i-4-icp-objections.md` (from 6.4)
- MODIFY `import_masterclass.py` (course_mc_4 block: append 1 section tuple after sec_mc_4_2)

## Étapes

1. Read c4-2 (dedup boundary) + Notion 6.1/6.2/6.3/6.4/6.0.
2. Author c4i-1..c4i-4, house voice, lexicon + objection scripts verbatim-useful.
3. In `import_masterclass.py`, inside `course_mc_4`, after `sec_mc_4_2`, append:
   ```python
   ("sec_mc_4_3", "First ICP: External SDR Agency", [
       ("les_mc_4_3_1", "The Agency World (Lexicon)", CONTENT / "c4i-1-the-agency-world.md"),
       ("les_mc_4_3_2", "Their Pain", CONTENT / "c4i-2-their-pain.md"),
       ("les_mc_4_3_3", "Buying Triggers & Where To Find Them", CONTENT / "c4i-3-buying-triggers.md"),
       ("les_mc_4_3_4", "ICP-Specific Objections", CONTENT / "c4i-4-icp-objections.md"),
   ]),
   ```
4. `python3 scripts/masterclass-import/import_masterclass.py` → `errors 0`.
5. Live verify tpb-browser on `course_mc_4`: 3 sections; the ICP section's 4 lessons render; lexicon +
   objection tables render; zero em/en-dash + citation; 0 console error.
6. Write `25-...plan.done.md`.

## Risques identifiés

- Overlap with c4-2 → this section is the drill-down; c4-2 stays the overview. If a specific fact
  duplicates, keep it in the deep lesson and trim c4-2 to a pointer sentence (no two full copies).
- 6.0 is a stub → folded as a short block inside c4i-3, not inflated into a fake lesson.

## Critères de validation

- `course_mc_4` shows 3 sections (The Offer, Product & Ecosystem, First ICP); 4 ICP lessons rendered.
- `import_masterclass.py` errors 0; zero em/en-dash + citation; 0 console error (tpb-browser).
- No duplicated full ICP overview between c4-2 and the new section.
