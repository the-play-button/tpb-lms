# TPB Sales Academy — content (rewritten to the lesson bar)

Rewrite of the authored content to match the quality bar of the good material (the old
Master class lessons — C.L.O.S.E.R, Discovery, Objections, Closing, Demo — and Nick
Saraev's outbound course): **written for the learner**, concrete examples + scripts,
properly-sized lessons, **zero meta** (no "old MC", no plan references, no file paths, no
"deferred/TODO", no bold-everything). Language: **English**, matching the good lessons and
the US-market offer.

The previous "framing/pillar" files were planning notes shipped as lessons — superseded and
removed (`/tmp/recovery_2026-07-05_masterclass-framing-superseded/`).

## Structure (28 lessons across 5 courses, all live in the LMS)

| Course | Lessons | Source |
|---|---|---|
| **1 — Vision & Context** | The Vision · How Companies Actually Go To Market · One Offer, Five Products | authored (`c1-*`) |
| **2 — Outbound Mastery** | How To Use This Course + Nick Saraev's 7 parts | intro authored (`c2-0`); parts = Nick (unchanged) |
| **3 — Sales Conversation** | The Craft Of The Conversation + C.L.O.S.E.R / Discovery / Objections / Closing / Demo | overview authored (`c3-0`); lessons = old Master class (unchanged) |
| **4 — The Offer** | What We Sell · Who We Sell To · The Value · Discovery · Objections · Pricing & Closing · After The Yes | authored (`c4-*`), grounded in `crm-hygiene-offer/` |
| **5 — Practice & Reinforcement** | Roleplay Scenarios · Shadowing Protocol · KPIs & Scorecard · Reinforcement Loop | authored (`c5-*`) |

## What was NOT touched (already good)

- **Course 2 lessons 1–7** = Nick Saraev's full cold-outbound course.
- **Course 3 lessons 1–5** = the original Master class lessons (C.L.O.S.E.R, Discovery,
  Objection handling, Closing techniques, Demo playbook).

## Grounding for Course 4 (The Offer)

All offer specifics (promise, 3 modules, 3 buckets, 6 triggers, pricing configurator, value
math, 4 guarantees + Win-Your-Money-Back, ICP) are sourced from
`Brain/the-play-button/pb01-offer-building/outputs/docs/crm-hygiene-offer/` (01 foundations,
02 pricing, 03 value-equation, 05 enhancers). The internal delivery mechanism stays internal
— lessons teach reps to **sell the outcome, never the mechanism**.

## Import

`scripts/masterclass-import/import_masterclass.py` maps each lesson to its source file and
pushes Program → Courses → Sections → Lessons via the LMS API (idempotent). Deferred: the
day-by-day format (Maker School style) — separate pass.
