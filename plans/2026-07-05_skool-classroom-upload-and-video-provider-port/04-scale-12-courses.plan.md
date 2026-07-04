# Plan 04 — Scale aux 12 cours (après UAT du POC)

## Contexte

Après validation UAT utilisateur du POC (Plan 03, `01_pre-program-start-here`), scaler
le pipeline aux **12 cours** de Maker School (~900 leçons, 413 Loom + 100 YouTube).
Ce plan ne démarre **qu'après** le « go » utilisateur sur le POC.

## Objectif

Uploader les 11 cours restants via le même script (batch), idempotent, avec throttle
+ reporting, et une vérif live d'échantillon.

## Étapes

### 1. Généraliser le script en batch
`scripts/skool-import/import_all.py` : walk les 12 `course_key` de `course_trees.json`,
appelle `import_course` par cours. Throttle (pause entre POST pour rester sous les
limites), reprise sur erreur (idempotent → re-run safe), reporting cumulé
(cours/sections/leçons créés/skippés + Loom privés flaggés).

### 2. Push GitHub global
Push l'arbre complet `classroom/` (12 cours + assets partagés) en un commit (ou par
cours). Vérifier la taille (assets) vs limites repo.

### 3. Loom privés — sweep complet
Tester les 413 `videoLink` loom (oEmbed) → liste des privés (fallback lien-only).
Rapport : X/413 embeddables, Y à traiter à la main.

### 4. Progression mode
Tous les cours en `progression_mode:'free'` (Maker School = navigation libre).
(Si l'utilisateur veut gater certains cours → flip par cours, trivial via l'API Plan 02.)

### 5. Vérif live échantillon (§ PLAN FRONTEND DONE)
tpb-browser : Classroom montre les 12 cartes ; ouvrir 2-3 cours (dont un « mois »
volumineux) → arbre complet, texte+images, vidéos Loom/YouTube qui jouent, 0 erreur
console. Compteurs cohérents (nb leçons par cours = attendu).

### 6. Bilan
Rapport final : 12 cours, N sections, M leçons, K vidéos (Loom embed / YouTube),
L Loom privés en fallback, temps total. Idempotence confirmée (2e run = 0 création).

## Fichiers

- `scripts/skool-import/import_all.py` (nouveau)
- rapport dans `plans/2026-07-05_.../_evidence/scale-report.md`

## Critères

- 12 cours + ~900 leçons uploadés 100% API + push GitHub, idempotent.
- Loom sweep : ratio public/privé documenté, privés en fallback lien-only.
- Live : 12 cartes Classroom, échantillon de cours rendus (texte/images/vidéos), 0 erreur console.
- Tous cours en nav `free`.

## Risques

- **Volume ~912 POST** : throttle + idempotence ; surveiller les limites API + D1 writes
  (§ AGENTIC RISK — mais ce sont des créations one-shot, pas un cron récurrent).
- **Assets volumineux sur GitHub** : les images peuvent peser ; vérifier la taille du
  repo (pas de vidéos poussées — elles sont en embed). Si trop lourd, héberger les
  images ailleurs (fetchable) et réécrire les URLs.
- **Loom privés** : sur les 413, ceux flaggés Skool-embed-only/DRM → fallback lien-only
  (leçon reste consultable, vidéo en lien externe). Documenté, pas bloquant.
- **Cette étape ne démarre qu'après UAT POC** (§ PAS DE PAUSES ne s'applique pas — c'est
  un gate UAT explicite demandé par l'utilisateur).
