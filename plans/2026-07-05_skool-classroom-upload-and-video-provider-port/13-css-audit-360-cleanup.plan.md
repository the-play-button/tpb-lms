# Plan 13 — Audit CSS 360 + cleanup

## Contexte

Audit CSS complet du viewer LMS (4018 lignes, ~19 fichiers). base.css a déjà un système
de tokens riche (couleurs, spacing, radius, shadows, durations — passes « entropy »
antérieures), mais 3 smells structurels subsistent :

1. **z-index anarchiques** — 12 valeurs brutes éparpillées (100, 500, 1000, 2000, 9999,
   10000) sans échelle → risque de stacking incohérent, pas de SSOT.
2. **Fallbacks de tokens périmés dans `kms.css`** — 17 `var(--x, #hex)` où le fallback
   diverge de la vraie valeur du token (ex `var(--text-secondary, #888)` mais
   `--text-secondary: #a0a0b0`). Les tokens sont définis → fallbacks jamais utilisés mais
   trompeurs (dette).
3. **Hex hardcodés résiduels learner-facing** — 5 (course.css / layout.css / buttons.css).

Le back-link `.classroom-back` (défaut button chrome) a déjà été fixé au tour précédent.

## Non-touché (légitime)

- `!important` de `animations.css` (`@media prefers-reduced-motion` — override a11y OK) et
  `responsive.css` (mobile `display:none` — override média OK).
- `!important` de `course.css` (`.warning-tip`, `.locked-hint`, etc.) — combattent le
  cascade `.markdown-body` sur du contenu injecté ; les retirer = risque régression couleur.
  Gardés (commentés).
- `base.css` (54 hex) = **définitions** des tokens (SSOT légitime).
- `debug.css` (36 hex) = panneau dev, non learner-facing (hors scope UX).
- `admin.css` (10 hex) = thème clair admin (palette distincte).

## Étapes

### 1. Échelle z-index tokenisée (`base.css`)
Ajouter une échelle sémantique (valeurs préservant le stacking actuel + toast au-dessus modal) :
```
--z-header: 100;      --z-overlay: 500;     --z-modal: 1000;
--z-toast: 1100;      --z-loading: 2000;    --z-debug: 9999;   --z-debug-top: 10000;
```
Remplacer les 12 `z-index: <n>` :
- `layout.css:22` (100) → `--z-header`
- `responsive.css:174` (500) → `--z-overlay`
- `responsive.css:97` / `kms.css:13` / `badge-modal.css:10` / `layout.css:302` (1000) → `--z-modal`
- `notifications.css:9` (1000) → `--z-toast` (1100, toast au-dessus des modals — correction sûre)
- `spinner.css:29` (2000) → `--z-loading`
- `animations.css:41` / `debug.css:11` (9999) → `--z-debug`
- `debug.css:186` (10000) → `--z-debug-top`
- `badge-modal.css:68` (1) = stacking local interne → laissé (pas un layer).

### 2. Nettoyage fallbacks périmés (`kms.css`)
`var(--token, #hex)` → `var(--token)` sur les 17 occurrences (les tokens sont définis dans
base.css). Zéro changement visuel (fallbacks jamais atteints), suppression de la dette.

### 3. Hex learner-facing → tokens (`course.css`, `layout.css`, `buttons.css`)
- `#f59e0b` (course quiz-start gradient) → `--warning` sombre : ajouter `--warning-dark: #f59e0b`.
- `#dc2626` (buttons error gradient) → ajouter `--error-dark: #dc2626`.
- `#3b82f6` (layout badge.rare border) → `--color-rarity-rare-text` (existe, `#60a5fa`) ou
  ajouter `--color-rarity-rare-border: #3b82f6`.
- `#000` / `#fff` on-image (course) → `--on-accent-dark: #000` / white token, ou laisser
  (contraste intentionnel sur gradient/cover). Décision : tokeniser `--color-black`/`--color-white`
  minimalistes si ça clarifie, sinon commenter l'intent.

### 4. Sweep visuel live (§ PLAN FRONTEND DONE)
tpb-browser sur les surfaces clés : classroom (grid + program cards), program landing
(back link + grid), course overview, lesson (video + texte + images + step nav + requirements),
quiz modal, badge modal, leaderboard, sidebar. Repérer les quirks visibles (débordements,
alignements, contrastes, boutons non stylés, spacing) → fix. Vérifier responsive (viewport
étroit) rapidement.

### 5. Gates
tsc n/a (CSS) · `vitest run` vert · entropy OK · 0 erreur console (fresh + reload) sur les
surfaces auditées.

## Fichiers

- `styles/base.css` (tokens z-index + couleurs manquantes)
- `styles/{layout,responsive,kms,animations,debug,course}.css`
- `styles/components/{badge-modal,notifications,spinner}.css`
- `styles/components/buttons.css`

## Critères

- Une échelle z-index tokenisée (SSOT), 0 z-index brut hors stacking local.
- kms.css sans fallbacks hex périmés.
- Hex learner-facing → tokens.
- Sweep live : surfaces clés sans quirk visible, 0 erreur console.

## Risques

- **Changement de stacking** : les tokens préservent les valeurs (sauf toast 1000→1100,
  correction sûre) → aucun régression attendue ; vérif live des modals/toasts.
- **Fallback kms retiré** alors que le token serait undefined → tous les tokens ciblés
  existent dans base.css (vérifié), donc no-op visuel.
