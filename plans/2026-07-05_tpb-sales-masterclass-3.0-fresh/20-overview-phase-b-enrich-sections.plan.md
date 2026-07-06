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

### SSOT & sourcing doctrine (correctif cardinal user 2026-07-06)

> Verbatim user : *« la master class est vieille … je veux pas que tu me pourrisses tout le
> travail en prenant la master class comme SSOT … tu ne vois même pas qu'on ne cible plus
> spécifiquement les SDR agencies ? … on va commencer par la niche des fabricants de textiles. »*

- **La masterclass Notion N'EST PAS le SSOT.** C'est une **source de skills + méthode** :
  le craft de la conversation (CLOSER, discovery, objections, closing, demo, roleplay), la
  **structure** d'une séquence de prospection, la **méthode** de profilage d'un ICP. Tout ce qui
  y est **offre / produit / ICP-spécifique est PÉRIMÉ** (ancien produit dialer « Phone Burster »,
  ancien ICP « External SDR Agency », offre unique). On ne l'importe **jamais verbatim**.
- **Le SSOT du positionnement / offres / ICP = la direction actuelle**, déjà matérialisée dans
  les leçons **live** du LMS :
  - `c1-3` : **une offre** (« wake up your dormant pipeline ») + **cinq produits** (CRM cleaning,
    outreach, sales reactivation, ABM paid ads, ABM email), ladder **clean → sales → ABM**.
  - `c4-1` « The Brutal CRM Truth » (offre d'entrée = diagnostic CRM cleaning).
  - `c4-2` ICP actuel : **B2B, US, mid-market** (50+ employés, 5 000+ contacts CRM), CRM sale ;
    6 triggers ; 3 buckets (Standard gratuit / custom-fields $5-15k / custom-stack $20-80k) ;
    référence **le cas WGE** (Wonder Grip Europe, fabricant industriel, ERP + CRM multi-source).
  - Ladder LVL1/2/3 du `_recension-decisions.md`.
- **ICP / première niche = FABRICANTS DE TEXTILES** (décision user 2026-07-06). Cohérent avec la
  référence WGE déjà dans `c4-2` (fabricant industriel mid-market). On sait qu'il faut **UN seul
  avatar** ; on démarre par les fabricants de textiles. La section ICP utilise la **méthode** de
  profilage de la Notion section 6 (lexique métier, pain points, buying triggers, objections)
  **appliquée aux fabricants de textiles + l'offre CRM-cleaning actuelle**, PAS le contenu SDR
  agencies verbatim.
- **Pas de fabrication** : il n'existe pas encore de matériel de positionnement textile dans le
  repo (constat grep 2026-07-06). Le contenu ICP textile se dérive de (a) le modèle de douleur de
  l'offre actuelle (WGE-like : ERP+CRM multi-source, délivrabilité, pipeline dormant) + (b) une
  **passe de recherche desk légère** sur les fabricants de textiles, **flaggée pour validation
  user**. On n'invente **jamais** un faux lexique insider. Si la profondeur métier manque, on le
  dit (§ ALWAYS FAIL HARD), on ne gonfle pas.
- **Voix** : chaque leçon nouvelle/réécrite suit le skill `marketing/content/copywriting/` +
  `reference/writing-a-course.md` : à la personne, ouvre sur la substance, scripts/tableaux/chiffres
  utilisables tels quels, **zéro em/en-dash**, zéro « in this lesson », zéro citation de source,
  **zéro vieux nom produit / vieil ICP**.

## Carte des sections à ajouter (SSOT du découpage)

Chaque « source » ci-dessous est **re-contextualisée** sur la direction actuelle (jamais verbatim).

| Cours (existant) | Section existante (gardée) | Sections AJOUTÉES | Source (skills/méthode) → re-contextualisée | Plan |
|---|---|---|---|---|
| 1 — Vision & Context | Vision & Context | **Who We Serve** (= ICP actuel + niche textile) ; **The Founder's Story** | c4-2 (ICP actuel SSOT) + méthode 1.2 ; 1.4 (si non-périmé) | 21 |
| 2 — Outbound Mastery | Outbound Mastery (Nick Saraev) | **Scripts & Strategy** | structure de 3.2 → offre actuelle (CRM cleaning) + niche textile | 22 |
| 3 — Sales Conversation | Sales Conversation | *(pas de nouvelle section — passe house-voice sur les 5 imports bruts)* | 3.1/3.3/3.4/3.5/3.6 (craft ICP-agnostique) | 23 |
| 4 — The Offer | The Offer | **The Five Products & How They Fit** | c1-3 + c4-7 (SSOT) + 2.3 integrations reframée ; **PAS** le deep-dive dialer 2.1 | 24 |
| 4 — The Offer | The Offer | **First Niche: Textile Manufacturers** | **méthode** 6.1/6.2/6.3/6.4 appliquée aux fabricants de textiles + offre actuelle | 25 |
| 5 — Practice & Reinforcement | Practice & Reinforcement | **Execution** ; **Reinforcement** (réconcilie c5-*) | 4.1/4.3/4.4 ; 5.3 (craft ICP-agnostique) | 26 |
| 6 — Onboarding & Daily Rhythm | (inchangé) | — | — | — |

## Plans

- **21** — Cours 1 : « Who We Serve » (ICP actuel c4-2 + niche textile) + « The Founder's Story ».
- **22** — Cours 2 : « Scripts & Strategy » — structure de 3.2 repositionnée sur l'offre actuelle
  (CRM cleaning) + niche textile, PAS le hook « audit HubSpot gratuit / 45 calls » SDR verbatim.
- **23** — Cours 3 : passe house-voice sur les 5 leçons brutes (craft ICP-agnostique).
- **24** — Cours 4 : « The Five Products & How They Fit » — ancré sur c1-3 + c4-7 (SSOT) + 2.3
  integrations reframée. **Drop** le deep-dive dialer 2.1 (produit périmé).
- **25** — Cours 4 : « First Niche: Textile Manufacturers » — méthode de profilage (6.1/6.2/6.3/6.4)
  appliquée aux fabricants de textiles + offre actuelle ; recherche desk flaggée pour validation.
- **26** — Cours 5 : « Execution » + « Reinforcement » (craft ICP-agnostique, réconcilie c5-*).

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
