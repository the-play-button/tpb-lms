# Initiative — TPB Sales Masterclass 3.0 (fresh, offer-tiered, practical, LMS-native)

**Date** : 2026-07-05
**Projet** : tpb-lms
**Owner** : Matthieu MARIE-LOUISE
**Statut** : OVERVIEW DRAFT — structure proposée, à valider avant de détailler les plans numérotés.

> Ceci est un **draft de direction**, pas encore le contrat d'exécution final. Après validation
> de la structure + du système de niveaux, on détaille les plans `01-`, `02-`, … (authoring +
> import LMS). Le user a demandé : « fais un draft de la nouvelle structure… après je te
> demanderai d'aller vraiment dans le détail ».

---

## Contexte

### D'où on part

- **Masterclass 1.0/2.0** (analysée) : onboarding sales très travaillé, adossé Hormozi (Core
  Four + CLOSER) + framework maison PACE-R + intelligence ICP exceptionnelle. **MAIS** : (a) écrite
  comme l'onboarding d'UN produit (« The Phoning Burst », le dialer copilot), (b) pas assez
  **pratico-pratique** (des ressources, mais pas de mise en pratique jetée-dans-le-bain jour-par-jour),
  (c) incohérences transversales (nom produit / devise / ROI / prix). Analyses :
  `the-play-button-business/plans/2026-07-05_lms-import-tpb-sales-masterclass/_analysis/{masterclass-content-analysis, masterclass-content-substance, offer-chain-context}.md`.
- **L'offre a mûri** : le copilot/BOSS reste **la VISION** (« la voix humaine est sacrée »,
  IA-propose/humain-valide, « many 1:1 »). Mais ce n'est pas UN produit — c'est **4 offres
  distinctes connectées**, vendues en **value ladder**, jamais toutes en même temps. Offre
  d'entrée cash-flow = **CRM hygiene cleaning** (« The Brutal CRM Truth »,
  `pb01-offer-building/outputs/docs/crm-hygiene-offer/`).
- **Nouvelle ressource dispo** : le **cold-outbound course de Nick Saraev** (7 leçons,
  `pb15-customer-marketing-playbook/inputs/sme-sources/nick-saraev/cold-outbound-course/`), bien
  fait, **pas encore sorti** quand la masterclass a été écrite → à intégrer au niveau SALES-outreach.

### Le système d'offres par niveau (opinionated) — cadrage utilisateur 2026-07-05

**Correctif clé** : ne pas confondre l'**ordre d'implémentation** (chez nous CRM toujours nettoyé
en premier, par volonté de **SOPs linéaires** — démarrer l'outbound d'un client sans nettoyer son
CRM ferait exploser la complexité opérationnelle) avec l'**ordre de VENTE**. Le marché regorge de
« lead agencies » qui vendent des prestas de lead-gen (outbound / paid ads) : concrètement **on
peut vendre n'importe laquelle des 4 offres en premier**. Le CRM cleaning **DOIT** juste figurer
comme **prérequis / bonus** de toute autre offre (tactique de pricing : « chez nous le cleaning
CRM est un passage obligatoire, on vous le fait à −50 % » = affichage ; en réalité on vend 2
produits d'un coup). Pour un **rep**, le détail d'implémentation n'existe pas ; il vend l'offre que
le client veut, le CRM cleaning ride toujours avec.

**Les 4 offres d'activation = une matrice 2×2** (motion × audience) + la fondation CRM :

|            | **LEADS** (nouveaux prospects) | **CUSTOMERS** (base payante existante) |
|------------|--------------------------------|-----------------------------------------|
| **SALES** (1:1 humain, direct) | **Outreach / Lead Sales** (cold outbound) | **Sales Reactivation / Customer Sales** (email perso *envoyé par les reps* + CRM task push + dialer) |
| **MARKETING** (1:many scalé, ABM) | **ABM Targeted Paid Ads** (lead marketing) | **ABM Email Campaigns** (customer marketing) |

**La ladder de niveaux** :

- **LVL1 — CRM Cleaning** (*The Brutal CRM Truth*) — fondation. Prérequis/bonus de tout le reste.
- **LVL2 — SALES** (nécessite LVL1) — les 2 offres SALES (outreach leads + reactivation customers).
- **LVL3 — MARKETING / ABM** (nécessite LVL2, branche B) — les 2 offres ABM (paid ads leads + email customers).

### Analyse de cohérence des niveaux (le user a demandé de « réfléchir très fort » + vérifier)

**LVL1 → LVL2 (CRM avant SALES) — cohérence FORTE ✓✓**
Prérequis data dur : sans data propre, les emails bouncent (sender reputation détruite), les
numéros sont morts (temps rep gâché), les segments sont faux (on ne sait pas qui est lead vs
customer, ni le lifecycle). *Garbage in = garbage out.* + argument SOP-linéarité (workflows
composables). Accepté par l'industrie (RevOps bloque l'outbound sur data sale ; la délivrabilité
email s'effondre sur listes sales). C'est littéralement « réactiver une mailing list = la nettoyer
d'abord ». **Rock solid.**

**LVL2 → LVL3 (SALES avant MARKETING/ABM) — cohérent, et ce n'est PAS une posture difficile ✓✓**
Correctif utilisateur 2026-07-05 (important) : le « funnel classique marketing → sales » est un
**biais de survivant**. Ce sont les gens visibles en ligne (créateurs de contenu, personal brands)
qui en parlent — une **minorité bruyante**. La **réalité marché** : **TOUTE** entreprise a des
**sales reps** (universel, sans exception) ; **très peu** postent du contenu / ont une personal
brand (rare). Donc « sales-led » n'est **pas** un pari contrariant à défendre — c'est le **défaut
du marché**.
- *Pourquoi la dépendance SALES → ABM tient* : notre **ABM (LVL3) n'est PAS le GTM marketing-led**.
  L'ABM = ciblage de **comptes** = précision = a besoin d'**intelligence 1st-party** (quels comptes
  ont engagé, quel message a résonné, intent) que **seule l'activité SALES génère**. C'est une
  **amplification posée sur la data sales**, distincte d'un point d'entrée marketing.
- *Distinction cardinale (correctif user)* : il **existe** un autre path de croissance qui commence
  par le marketing **sans focus ABM** — paid ads large + organic content + publication marketplace,
  etc. = **GTM marketing-led**. Ce **serait une autre offre d'entrée (un LVL1 alternatif)** — mais
  **on ne la vend pas / on ne se focus pas dessus**. Notre LVL3 ABM ≠ ce marketing-led ; d'où
  pourquoi l'ABM reste bien au-dessus de la data sales et n'entre pas en contradiction.

**Verdict honnête** : le système est **cohérent, et fondé sur la réalité marché** (pas un pari
fragile). Rien de difficile à « assumer » : c'est ce qu'on **choisit de vendre**, pas un jugement
sur les autres paths.

### Le style pédagogique visé (correctif « pas assez pratico-pratique »)

Comme la classroom **Maker School** (jeté-dans-le-bain : day 1, day 2…) et le **CLOSER handbook
d'Hormozi** (planning jour-par-jour des 2 premières semaines d'onboarding sales). Le contenu de
référence reste, mais on ajoute une **couche d'exécution jour-par-jour** (Onboarding Sprint Day
1→14) qui met le rep en pratique dès J1.

---

## Structure proposée — Masterclass 3.0 (draft à valider)

Program LMS : **« TPB Sales Academy »**. Chaque niveau = un Course ; prerequisites gated
(learning tracks + sequence). Chaque offre réutilise **le même squelette pédagogique**
(product knowledge · ICP nuances · discovery · objections · demo · pricing · closing) — on
capitalise, on ne réécrit pas 4 fois.

```
PROGRAM : TPB Sales Academy
│
├── COURSE 0 — FOUNDATIONS  (partagé, prérequis de tout)
│     • The Vision : BOSS · copilot · "human voice is sacred" · many 1:1
│     • The 4 GTM Growth Paths (culture d'entreprise) : sales-led (universel — toute boîte a des
│       reps) · marketing-led (paid ads + organic + marketplace, sans ABM) · partner-led ·
│       PLG-led (SaaS). Tous VALIDES (on les suit nous-mêmes en interne). **Ce qu'on VEND = le
│       sales-led + la fondation CRM.** Choisir quoi vendre ≠ cracher sur les autres paths.
│     • The TPB Sales Doctrine : PACE-R · C.L.O.S.E.R · under-promise/over-deliver (transversal)
│     • The Offer Map : les 4 offres, 3 niveaux, la value ladder, "CRM ride toujours avec" (−50% tactic)
│     • Master ICP fundamentals : lead agencies + B2B mid-market avec CRM (élargi vs "External SDR Agency")
│
├── COURSE 1 — LEVEL 1 : CRM CLEANING (The Brutal CRM Truth)   [prereq: Foundations]
│     • Product knowledge (hygiene engine, scorecard, diagnostic de contrainte)
│     • ICP nuances (6 triggers d'urgence, 3 buckets : Standard / custom-fields / custom-stack)
│     • Discovery (le "constraint diagnostic")  • Objections (in-house, data ownership)
│     • Demo (scorecard + 2-page diagnostic)  • Pricing (tiered + value equation)  • Closing
│     ↳ source : pb01 crm-hygiene-offer/ (01→08)
│
├── COURSE 2 — LEVEL 2 : SALES   [prereq: LVL1]
│     ├── 2a. Outreach / Lead Sales (cold outbound sur leads)
│     │     ↳ source : Nick Saraev cold-outbound course (pb15) + pb03 outbound + old mod 3 scripts
│     └── 2b. Sales Reactivation / Customer Sales (email perso par reps + CRM task push + dialer)
│           ↳ source : old masterclass "The Phoning Burst" (dialer copilot = le gros de l'existant)
│
├── COURSE 3 — LEVEL 3 : MARKETING / ABM   [prereq: LVL2, branche B]
│     ├── 3a. ABM Targeted Paid Ads (lead marketing)
│     └── 3b. ABM Email Campaigns (customer marketing)
│           ↳ source : à sourcer (matériel le plus fin ; contenu neuf le plus important)
│
└── COURSE X — THE ONBOARDING SPRINT (Day 1 → Day 14)  [cross-cutting, pratico-pratique]
      • Planning jour-par-jour "jeté dans le bain" (style Maker School + Hormozi CLOSER handbook)
      • Mappe le contenu de référence en actions quotidiennes : roleplay, shadowing, 1res calls,
        1er pitch CRM cleaning, 1re discovery, etc.
      ↳ source : old mod 4 (Execution) + mod 5 (Reinforcement) reformattés en day-by-day
```

### Mapping de rewire (sources → nouvelle structure)

| Source existante | Va dans |
|---|---|
| Old mod 0 (Core Four Hormozi) | Foundations — vision/acquisition theory |
| Old mod 1 (vision/positioning/target/founder) | Foundations (vision) + éclaté par offre pour le reste |
| Old mod 3 (CLOSER, discovery, demo, objections, closing) | Foundations (skills transversaux) + décliné par offre |
| Old mod 4 (roleplay, shadowing, KPIs, CRM hygiene) | **Onboarding Sprint** (day-by-day) |
| Old mod 5 (coaching, call library, feedback, scorecard) | **Onboarding Sprint** + reinforcement continu |
| Old mod 6 (ICP External SDR Agency) | Foundations ICP + nuances ICP par niveau |
| Old dialer product content (The Phoning Burst) | **LVL2 · 2b** Sales Reactivation |
| pb01 crm-hygiene-offer/ (01→08) | **LVL1** CRM Cleaning |
| Nick Saraev cold-outbound course (pb15, 7 leçons) | **LVL2 · 2a** Outreach |
| Maker School style + Hormozi CLOSER handbook | Format de l'**Onboarding Sprint** |

---

## Fichiers impactés (draft — à préciser dans les plans numérotés)

- `Apps/the-play-button/tpb-lms/plans/2026-07-05_tpb-sales-masterclass-3.0-fresh/` — cette
  initiative (overview + plans numérotés à venir + `_content/` markdown authoring).
- Contenu masterclass 3.0 authored en markdown (probable `_content/` par Course/Section/Lesson)
  puis importé dans tpb-lms via le pattern de l'import Skool
  (`plans/2026-07-05_skool-classroom-upload-and-video-provider-port/`).
- tpb-lms backend : réutilise l'ERD Program→Course→Section→Lesson + prerequisites/learning-tracks
  (aucune migration ERD attendue a priori — à confirmer au détail).
- Sources en lecture seule (inputs) : `Brain/.../pb01-offer-building/outputs/docs/crm-hygiene-offer/`,
  `Brain/.../pb05.../Master class/`, `Brain/.../pb15.../nick-saraev/cold-outbound-course/`.

---

## Étapes (draft de haut niveau — les plans numérotés viendront après validation)

1. **Valider** cette structure + le système de niveaux + la posture sales-led (ce doc).
2. **Plan 01 — Foundations + Offer Map** : authoring du Course 0 (vision + doctrine + offer map + ICP maître).
3. **Plan 02 — Level 1 CRM Cleaning** : authoring depuis crm-hygiene-offer/, en forme "comment vendre".
4. **Plan 03 — Level 2 SALES** : 2a Outreach (Nick Saraev + pb03) + 2b Reactivation (dialer existant).
5. **Plan 04 — Level 3 MARKETING/ABM** : 3a paid ads + 3b email (contenu le plus neuf).
6. **Plan 05 — Onboarding Sprint Day 1→14** : le planning pratico-pratique jour-par-jour.
7. **Plan 06 — Cohérence transversale** : 1 nom produit / 1 devise / 1 histoire ROI / 1 grille prix.
8. **Plan 07 — Import LMS** : seed Program/Courses/Sections/Lessons + prerequisites dans tpb-lms
   (mirror du pattern Skool import) + verify UI tpb-browser.

---

## Risques identifiés

- **Sur-scope** : recréer 4 tracks de vente + onboarding sprint = gros volume d'authoring. Mitigation :
  squelette pédagogique partagé réutilisé par offre ; phaser par Course (un plan = un niveau).
- **Incohérence de posture non assumée** : si on n'enseigne pas explicitement le "sales-led /
  ABM-needs-sales-data", la ladder paraîtra arbitraire. Mitigation : un module Foundations qui
  POSSÈDE la posture + prépare la défense d'objection.
- **AI slop hérité** (Brutal CRM Truth) : giveaway $602,800, catalog 62, combinatoire garanties.
  Mitigation : garder le cœur (offre + 3 modules + diagnostic + value ladder), écarter le slop.
- **Contenu LVL3 (ABM) mince** : c'est le plus neuf, peu de source. Mitigation : le sourcer /
  l'écrire en dernier, ne pas bloquer les niveaux 1-2 dessus.
- **Décalage vision vs réalité produit** : la masterclass doit dire clairement « vision = BOSS ;
  chemin = 4 offres en ladder » sans jeter la vision (elle reste le "why").

---

## Critères de validation

- [ ] La structure 3.0 (Foundations + LVL1/2/3 + Onboarding Sprint) est validée par le user.
- [ ] Le système de niveaux + la posture sales-led sont jugés cohérents (analyse ci-dessus).
- [ ] Le mapping de rewire (chaque source → sa destination) est validé.
- [ ] Les plans numérotés 01→07 sont écrits (contrats détaillés, contenu réel).
- [ ] Le contenu authored est pratico-pratique (Onboarding Sprint day-by-day présent).
- [ ] Import LMS live-vérifié via tpb-browser (Program/Courses/prerequisites naviguables).
- [ ] Cohérence transversale : 1 nom / 1 devise / 1 ROI / 1 pricing.
