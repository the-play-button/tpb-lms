# 26 — Course 5 (Practice & Reinforcement): split into « Execution » + « Reinforcement » sections

## Contexte

Course `course_mc_5` "5 — Practice & Reinforcement" has ONE section today:
`("sec_mc_5_1", "Practice & Reinforcement", [c5-1 roleplay-scenarios, c5-2 shadowing, c5-3 kpis-and-scorecard, c5-4 reinforcement-loop])`.

These 4 lessons (already house-voiced by me) mix execution and reinforcement. We make the course
homogeneous by splitting into TWO sections and folding the substantial Notion practical details not
yet reflected:
- **Execution** ← c5-1 roleplay + c5-2 shadowing, enriched with `4.1 Roleplay scenario.md` (383w),
  `4.3 KPIs.md` (461w), `4.4 CRM Hygiene.md` (517w).
- **Reinforcement** ← c5-3 kpis/scorecard + c5-4 loop, enriched with `5.3 Product feedback loop.md`
  (389w). (Stubs 4.2 shadowing 128w, 5.1 coaching 173w, 5.2 call library 271w, 5.4 scorecard 232w →
  folded as short blocks into the relevant lesson, not their own lessons per 20.)

**Reconciliation (§ BIG BANG)**: do NOT create parallel lessons duplicating c5-*. Enrich the existing
c5-* files in place (add the Notion practical details as new sections inside each lesson), then
re-group them under the two new section headers in the manifest. One lesson set, no duplication.

House voice = copywriting skill. Zero em/en-dash, zero citation.

## Fichiers impactés

- MODIFY `.../_content/c5-1-roleplay-scenarios.md` (fold Notion 4.1 roleplay scenario specifics)
- MODIFY `.../_content/c5-2-shadowing.md` (fold 4.2 shadowing program specifics — short)
- MODIFY `.../_content/c5-3-kpis-and-scorecard.md` (fold 4.3 KPIs + 5.4 scorecard specifics)
- MODIFY `.../_content/c5-4-reinforcement-loop.md` (fold 5.1 coaching + 5.2 call library + 5.3 feedback loop)
- CREATE `.../_content/c5-5-crm-hygiene-discipline.md` (from Notion 4.4 CRM Hygiene — new lesson, execution)
- MODIFY `import_masterclass.py` (course_mc_5 block: 1 section → 2 sections, regroup lessons)

## Étapes

1. Read Notion 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4.
2. Enrich c5-1..c5-4 in place with the practical specifics (house voice), and author c5-5 (CRM hygiene
   discipline) from 4.4.
3. Rewrite the `course_mc_5` block into two sections:
   ```python
   ("course_mc_5", "5 — Practice & Reinforcement", [
       ("sec_mc_5_1", "Execution", [
           ("les_mc_5_1_1", "Roleplay Scenarios", CONTENT / "c5-1-roleplay-scenarios.md"),
           ("les_mc_5_1_2", "The Shadowing Protocol", CONTENT / "c5-2-shadowing.md"),
           ("les_mc_5_1_5", "CRM Hygiene Discipline", CONTENT / "c5-5-crm-hygiene-discipline.md"),
       ]),
       ("sec_mc_5_2", "Reinforcement", [
           ("les_mc_5_1_3", "Your KPIs & Scorecard", CONTENT / "c5-3-kpis-and-scorecard.md"),
           ("les_mc_5_1_4", "The Reinforcement Loop", CONTENT / "c5-4-reinforcement-loop.md"),
       ]),
   ]),
   ```
   (Keep existing lesson ids so progress survives; new lesson id `les_mc_5_1_5`.)
4. `python3 scripts/masterclass-import/import_masterclass.py` → `errors 0`.
5. Live verify tpb-browser on `course_mc_5`: 2 sections (Execution, Reinforcement); 5 lessons render;
   zero em/en-dash + citation; 0 console error.
6. Write `26-...plan.done.md`.

## Risques identifiés

- Moving lessons across section ids: the importer upserts LESSON with `parentClassId = sid`. Re-parenting
  `les_mc_5_1_3/4` under `sec_mc_5_2` is an UPDATE of parentClassId — verify the importer's upsert sends
  parentClassId (it does, line ~198). If a stale parent remains, re-run import (idempotent).
- Stubs must not be inflated → folded as short blocks, not fake lessons.

## Critères de validation

- `course_mc_5` shows 2 sections; 5 lessons correctly parented; progress on existing lessons preserved.
- `import_masterclass.py` errors 0; zero em/en-dash + citation; 0 console error (tpb-browser).
- No duplicated c5 lesson (enriched in place, not copied).
