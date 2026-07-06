# Phase B — Enrich the live LMS by adding sections inside the existing courses

**Date** : 2026-07-06 · **Projet** : tpb-lms · **Owner** : Matthieu MARIE-LOUISE
**Statut** : OVERVIEW — contrat de découpage, plans `21`..`26` détaillés à côté.

## Contexte

La masterclass 3.0 est **live** dans le LMS (6 cours, format validé par le user 2026-07-06 :
*« le format de ce qu'on a côté tpb lms commence à être ok »*). Chaque cours n'a **qu'UNE
section** aujourd'hui (ex. cours « Outbound Mastery » → une seule section « Outbound Mastery
(Nick Saraev) »). Le contenu riche et pratique de la masterclass Notion
(`Brain/the-play-button/pb05-lead-sales-training-program/inputs/TPB Notion/TPB Sales On-Boarding/Master class/`,
38 fichiers) n'est **pas** intégré : seuls 5 fichiers de la section 3 sont câblés.

**Demande user 2026-07-06** : ne PAS créer de nouveaux cours. **Ajouter des sections** dans les
cours existants pour enrichir, de façon **homogène**. C'est beaucoup d'infos → vraie initiative,
déroulée **plan par plan**.

### Constats préalables (2026-07-06)

- L'importer supporte déjà N sections par cours : `import_masterclass.py` boucle
  `for si, (sid, sname, lessons) in enumerate(sections)` (ligne 187) → ajouter une section =
  ajouter un tuple `(section_id, section_name, [lessons])` dans la liste du cours. Aucun changement
  de code importer nécessaire, juste le manifeste `COURSES`.
- Structure ERD : Program → Course → Class(SECTION) → Class(LESSON). `sysOrderIndex` ordonne
  sections et lessons. Import idempotent (upsert par id). Covers préservés via `course_cover()`.
- Word counts des sources Notion (substantiel = à intégrer ; stub = à écarter) :
  - **Substantiel** : 3.2 Scripts&Strategy 1600w · 2.1 deep-dive 1176w · 2.2 demo use-cases 1585w ·
    2.3 integrations 1449w · 2.4 customer stories 1510w · 2.5 limitations 1413w · 6.1 SDR lexicon
    1018w · 6.2 pain points 1126w · 6.3 buying triggers 800w · 6.4 objections 1607w · 1.2 target
    market 987w · 1.3 positioning 1551w · 1.4 founder narrative 1289w · 4.1 roleplay 383w · 4.3
    KPIs 461w · 4.4 CRM hygiene 517w · 5.3 feedback loop 389w.
  - **Stub (écarter ou fondre en 1 ligne)** : 3.0 inbox 23w · 7 advanced 54w · 6.0 how-to-find 20w ·
    0. what-is-sales 195w · 4.2 shadowing 128w · 5.1 coaching 173w · 5.2 call library 271w · 5.4
    scorecard 232w · Z. LinkedIn 91w.

### Décisions actées (pas de question au user)

- **Nom produit (ex-O3)** : la section « Product & Ecosystem » réconcilie la section 2 Notion (qui
  utilise les vieux noms « TPB Sales Assistant / Phone Burster ») sur le **naming déjà live dans le
  LMS** : « One Offer, Five Products » (c1-3) + « The Brutal CRM Truth » (c4-1) + « the Five
  Products » (c4-7). Aucun nouveau nom inventé, aucune question.
- **Taxonomie d'offres (ex-O1)** : hors scope. On folde uniquement le contenu **pédagogique**
  (produit, ICP, scripts, skills) qui ne dépend pas du ladder. Le ladder reste tel quel.
- **Voix** : chaque leçon nouvelle/réécrite suit le skill `marketing/content/copywriting/` +
  `reference/writing-a-course.md` : à la personne, ouvre sur la substance, scripts/tableaux/chiffres
  utilisables tels quels, **zéro em/en-dash**, zéro « in this lesson », zéro citation de source.

## Carte des sections à ajouter (SSOT du découpage)

| Cours (existant) | Section existante (gardée) | Sections AJOUTÉES | Source Notion | Plan |
|---|---|---|---|---|
| 1 — Vision & Context | Vision & Context | **Who We Serve & How We Win** ; **The Founder's Story** | 1.2 + 1.3 ; 1.4 | 21 |
| 2 — Outbound Mastery | Outbound Mastery (Nick Saraev) | **Scripts & Strategy** | 3.2 | 22 |
| 3 — Sales Conversation | Sales Conversation | *(pas de nouvelle section — passe house-voice sur les 5 imports bruts)* | 3.1/3.3/3.4/3.5/3.6 | 23 |
| 4 — The Offer | The Offer | **Product & Ecosystem** | 2.1→2.5 | 24 |
| 4 — The Offer | The Offer | **First ICP: External SDR Agency** | 6.1/6.2/6.3/6.4 (+6.0) | 25 |
| 5 — Practice & Reinforcement | Practice & Reinforcement | **Execution** ; **Reinforcement** (réconcilie c5-*) | 4.1/4.3/4.4 ; 5.3 (+ existants) | 26 |
| 6 — Onboarding & Daily Rhythm | (inchangé) | — | — | — |

## Plans

- **21** — Cours 1 : sections « Who We Serve & How We Win » + « The Founder's Story ».
- **22** — Cours 2 : section « Scripts & Strategy » (le gros bloc pratique outbound).
- **23** — Cours 3 : passe house-voice sur les 5 leçons brutes (homogénéité).
- **24** — Cours 4 : section « Product & Ecosystem » (réconciliée au naming LMS).
- **25** — Cours 4 : section « First ICP: External SDR Agency » (lexicon, pain, triggers, objections).
- **26** — Cours 5 : sections « Execution » + « Reinforcement » (fold Notion 4.x/5.x, réconcilie c5-*).

Chaque plan : author les leçons `_content/*.md` (house-voice) → câbler le manifeste `COURSES` →
`import_masterclass.py` (errors 0) → **live verify tpb-browser** (sections + lessons rendues,
tables OK, zéro em/en-dash, zéro citation, 0 console error) → `.done.md`. Rollout **en série**,
un plan à la fois.

## Fichiers

- `plans/2026-07-05_tpb-sales-masterclass-3.0-fresh/20-overview-phase-b-enrich-sections.plan.md` (ce fichier)
- `plans/2026-07-05_tpb-sales-masterclass-3.0-fresh/2{1..6}-*.plan.md` (contrats)
- `plans/.../_content/*.md` (nouvelles leçons, un fichier par leçon, par plan)
- `Apps/the-play-button/tpb-lms/scripts/masterclass-import/import_masterclass.py` (manifeste `COURSES`)
- `Apps/the-play-button/tpb-lms/TODO.md` (lien initiative — phase B)

## Étapes

1. Valider ce découpage (overview) avec le user.
2. Exécuter 21 → `.done.md`, puis 22 → `.done.md`, … jusqu'à 26, en série.
3. À chaque plan : import + deploy si besoin + live verify + report.

## Risques

- **Duplication avec c1/c4/c5 existants** (§ BIG BANG) → chaque plan réconcilie en UN jeu de leçons
  par thème, jamais deux. 23 et 26 explicitent la réconciliation.
- **Sources stub** (3.0/7/6.0/0/…) → écartées ou fondues en une ligne, jamais gonflées en fausse
  leçon (§ ALWAYS FAIL HARD sur le vide).
- **Ordre des sections** (`sysOrderIndex`) → la section existante reste #1, les ajouts suivent.
- **Covers** → préservés via `course_cover()` à chaque re-import.

## Critères de validation

- Chaque cours ciblé passe de 1 section à N sections cohérentes ; contenu Notion substantiel
  représenté en leçons house-voice.
- `import_masterclass.py` : `errors 0` après chaque plan.
- Live verify tpb-browser par plan : nouvelles sections + leçons visibles dans la sidebar,
  tables rendues, zéro em/en-dash, zéro citation/« Hormozi »/« in this lesson », 0 console error.
- Aucune leçon live existante supprimée (§ INTERDICTION DE REVERT).
