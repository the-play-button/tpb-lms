# 23 — Course 3 (Sales Conversation): house-voice the 5 raw Notion imports

## Contexte

Course `course_mc_3` "3 — Sales Conversation" already has substantial content, but 5 of its 6 lessons
point **straight at the raw Notion files** (`MC / "3.1 Sales methodo - C.L.O.S.E.R.md"`, etc.), so
they read in a different (source) voice than the rest of the LMS. No substantial NEW Notion content
exists for this course (`3.0 Inbox` 23w and `7 Advanced` 54w are stubs — écartés per 20). So this
plan is a **homogeneity pass**: rewrite the 5 raw imports into house voice as `_content/c3-*.md` and
repoint the manifest. The section stays one; the content becomes consistent.

Current `course_mc_3` block:
```python
("sec_mc_3_1", "Sales Conversation", [
    ("les_mc_3_1_0", "The Craft Of The Conversation", CONTENT / "c3-0-the-craft-of-the-conversation.md"),  # already house-voiced
    ("les_mc_3_1_1", "C.L.O.S.E.R", MC / "3.1 Sales methodo - C.L.O.S.E.R.md"),
    ("les_mc_3_1_2", "Discovery playbook", MC / "3.3 Discovery playbook.md"),
    ("les_mc_3_1_3", "Objection handling", MC / "3.5 Objection handling.md"),
    ("les_mc_3_1_4", "Closing techniques", MC / "3.6 Closing techniques.md"),
    ("les_mc_3_1_5", "Demo playbook", MC / "3.4 Demo Playbook.md"),
]),
```

House voice = copywriting skill. Keep the CLOSER acronym, the discovery questions, the objection
loops, the closing lines, the demo flow **verbatim-useful** (scripts as blockquotes, do/don't tables).
Zero em/en-dash, zero "in this lesson", zero source citation.

## Fichiers impactés

- CREATE `.../_content/c3-1-closer.md` (from Notion `3.1 Sales methodo - C.L.O.S.E.R.md`)
- CREATE `.../_content/c3-2-discovery.md` (from `3.3 Discovery playbook.md`)
- CREATE `.../_content/c3-3-objections.md` (from `3.5 Objection handling.md`)
- CREATE `.../_content/c3-4-closing.md` (from `3.6 Closing techniques.md`)
- CREATE `.../_content/c3-5-demo.md` (from `3.4 Demo Playbook.md`)
- MODIFY `import_masterclass.py` (course_mc_3 block: repoint les 5 lessons vers CONTENT/c3-*.md)

## Étapes

1. Read the 5 raw Notion files (3.1, 3.3, 3.5, 3.6, 3.4).
2. Author `c3-1..c3-5` in house voice, preserving all scripts/questions/loops verbatim-useful.
3. Repoint the 5 lesson tuples in `course_mc_3` from `MC / "..."` to `CONTENT / "c3-N-*.md"` (keep same
   `les_mc_3_1_*` ids + names so progress is preserved).
4. `python3 scripts/masterclass-import/import_masterclass.py` → `errors 0`.
5. Live verify tpb-browser on `course_mc_3`: 6 lessons render house-voiced; CLOSER table + discovery
   questions + objection loops render; zero em/en-dash + citation; 0 console error.
6. Write `23-...plan.done.md`.

## Risques identifiés

- These are the richest source files (1900-2200w) → the rewrite must not drop scripts. Mitigation:
  each lesson keeps every script/question as a blockquote/table; trim only prose padding.
- Repointing ids must stay identical → progress rows keyed on lesson id survive.
- **Vieux ICP/produit dans les exemples** (voir 20-overview § SSOT & sourcing) : les fichiers bruts
  peuvent illustrer avec « SDR agency » ou l'ancien produit dialer. La réécriture **repositionne
  tout exemple** sur l'offre actuelle (CRM cleaning) + la niche textile ; le craft (CLOSER,
  discovery, objections, closing, demo) reste ICP-agnostique mais les **exemples** sont actualisés.
  Grep de sortie : zéro « SDR agency » / « Phone Burster » dans c3-1..c3-5.

## Critères de validation

- 5 lessons now served from `_content/c3-*.md`, house-voiced, scripts intact.
- `import_masterclass.py` errors 0.
- Zero em/en-dash, zero citation, 0 console error (tpb-browser).
- Lesson ids unchanged (les_mc_3_1_1..5); c3-0 craft lesson intact.
