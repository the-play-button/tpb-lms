# Plan 13 — Audit CSS 360 + cleanup — DONE (2026-07-05)

## Résultat

Audit CSS complet (4018 lignes, ~19 fichiers) + cleanup des 3 smells structurels.
Vérifié live (classroom / program landing / leçon riche). 199 tests, entropy OK, déployé.

## Ce qui a été fait

### 1. Échelle z-index tokenisée (base.css)
7 tokens SSOT : `--z-header:100 < --z-overlay:500 < --z-modal:1000 < --z-toast:1100 <
--z-loading:2000 < --z-debug:9999 < --z-debug-top:10000`. **12 valeurs brutes** remplacées
(layout, responsive, kms, animations, debug, badge-modal, notifications, spinner). Ordre
de stacking préservé ; toast passé au-dessus des modals (1000→1100, correction sûre). Seul
`z-index:1` local (badge-modal, stacking interne) conservé. Vérifié live : tous les tokens
résolvent (header computed = 100), aucune régression.

### 2. kms.css — fallbacks périmés supprimés
**17** `var(--token, #hex/px/rgba)` → `var(--token)`. Les tokens sont tous définis dans
base.css → les fallbacks étaient morts **et trompeurs** (ex `var(--text-secondary, #888)`
alors que `--text-secondary: #a0a0b0`). Zéro changement visuel.

### 3. Hex learner-facing → tokens (course/layout/buttons)
`#f59e0b`→`--warning-dark`, `#dc2626`→`--error-dark`, `#3b82f6`→`--color-rarity-rare-border`,
`#000`→`--on-warning`, `#fff`→`--on-media` (nouveaux tokens dans base.css). 0 hex hardcodé
restant en learner-facing.

## Gardé (légitime — documenté)

- `!important` : `animations.css` (`@media prefers-reduced-motion` — override a11y),
  `responsive.css` (mobile `display:none`), `course.css` (`.warning-tip`/`.locked-hint`
  overrides du cascade `.markdown-body` sur contenu injecté — retrait = risque régression).
- `base.css` (54 hex) = **définitions** des tokens (SSOT).
- `debug.css` (36 hex) = panneau dev, non learner-facing.
- `admin.css` (10 hex) = thème clair admin (palette distincte).

## Vérif live (§ PLAN FRONTEND DONE)

- **Leçon** (Month 1 step 13, vidéo Loom + 17 images CDN + blockquote + step nav +
  requirements) : sidebar arbre sections/jours propre, back link « ← Tous les cours »
  clean, boutons Précédent (sombre) / Suivant (accent violet, CTA), box requirements
  bordée. **Pas d'overflow horizontal**.
- **Classroom / program landing** : cartes alignées, program card, covers, ▶.
- Tokens z-index résolvent, **0 erreur console** sur toutes les surfaces (fresh + reload).

### Gates
- `vitest run` 199/199 · entropy RATCHET OK · lms-viewer déployé.

## Fichiers

- `styles/base.css` (tokens z-index + couleurs)
- `styles/{layout,responsive,kms,animations,debug,course}.css`
- `styles/components/{badge-modal,notifications,spinner,buttons}.css`

## Note (hors CSS, repéré au sweep)

En mode `free` (Month 1), la box « Pour débloquer Suivant : Regarder la vidéo à 90% »
s'affiche alors que « Suivant » est déjà déverrouillé (nav libre). C'est de la **logique**
(`renderRequirements`), pas du CSS — à traiter séparément si tu veux masquer la box en free.
