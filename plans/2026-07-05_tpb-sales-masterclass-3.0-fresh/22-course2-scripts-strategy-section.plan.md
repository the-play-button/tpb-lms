# 22 — Course 2 (Outbound Mastery): add « Scripts & Strategy » section

## Contexte

Course `course_mc_2` "2 — Outbound Mastery" has ONE section today:
`("sec_mc_2_1", "Outbound Mastery (Nick Saraev)", [c2-0 how-to-use + 7 video parts])`.

We ADD one section from Notion `3.2 Scripts n Strategy.md` (1600w, constat 2026-07-06) — the most
practical outbound content the user built: the free-audit hook, the 50/50 multi-channel + cold-call
strategy, the full email/LinkedIn/video sequence, the cold-call hook with branch responses, the free
audit process, conversion flow, metrics, and free-offer objection handling. Splitting keeps each
lesson openable on its own substance.

House voice = copywriting skill. **Keep every script verbatim-useful** as `> "..."` blockquotes the
rep can lift word for word; keep the metrics tables. Zero em/en-dash, zero citation.

Importer: append one section tuple to the `course_mc_2` block (§ 20 constat).

## Fichiers impactés

- CREATE `.../_content/c2s-1-prospecting-strategy.md` (free hook → real proposal; 50/50 channel mix; ICP reminder)
- CREATE `.../_content/c2s-2-multi-channel-sequence.md` (Email 1 free audit, Email 2 real proposal, LinkedIn, video email + 2-min video script)
- CREATE `.../_content/c2s-3-cold-call-playbook.md` (the hook + "not interested"/"send info"/"interested" branches)
- CREATE `.../_content/c2s-4-free-audit-and-conversion.md` (audit process + deliverables, conversion flow day-by-day, success metrics, free-offer objections)
- MODIFY `import_masterclass.py` (course_mc_2 block: append 1 section tuple)

## Étapes

1. Read Notion `3.2 Scripts n Strategy.md` in full.
2. Author the 4 lessons above, house voice, scripts as lift-and-use blockquotes, metrics as tables.
3. In `import_masterclass.py`, inside `course_mc_2`, after `sec_mc_2_1`, append:
   ```python
   ("sec_mc_2_2", "Scripts & Strategy", [
       ("les_mc_2_2_1", "Our Prospecting Strategy", CONTENT / "c2s-1-prospecting-strategy.md"),
       ("les_mc_2_2_2", "The Multi-Channel Sequence", CONTENT / "c2s-2-multi-channel-sequence.md"),
       ("les_mc_2_2_3", "The Cold-Call Playbook", CONTENT / "c2s-3-cold-call-playbook.md"),
       ("les_mc_2_2_4", "The Free Audit & Conversion Flow", CONTENT / "c2s-4-free-audit-and-conversion.md"),
   ]),
   ```
4. `python3 scripts/masterclass-import/import_masterclass.py` → `errors 0`.
5. Live verify tpb-browser on `course_mc_2`: 2 sections; the 4 new lessons render; script blockquotes
   + metrics tables render; zero em/en-dash + citation; 0 console error.
6. Write `22-...plan.done.md`.

## Risques identifiés

- The source uses `{{FirstName}}`/`{{CompanyName}}` merge tokens → keep them as-is (they're the real
  template), just render inside code/blockquote blocks so markdown doesn't mangle them.
- Metrics are the user's targets (open 45%+, reply 12%+, etc.) → keep verbatim, don't invent.

## Critères de validation

- `course_mc_2` shows 2 sections; 4 new lessons reachable and rendered with scripts + metrics tables.
- `import_masterclass.py` errors 0.
- Zero em/en-dash, zero citation, 0 console error (tpb-browser).
- Nick video section (sec_mc_2_1) intact.
