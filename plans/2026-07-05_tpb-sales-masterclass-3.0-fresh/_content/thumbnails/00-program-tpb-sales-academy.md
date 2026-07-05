# Thumbnail — Programme « TPB Sales Academy » (cover hero)

**Généré :** 2026-07-05
**Méthode :** image générative (ChatGPT / DALL·E, Midjourney, ou Flux), raster.
**Cible LMS :** cover du **Program** `prog_mc_sales_academy` — `mediaJson` IMAGE, ratio **16:9**.
**Rôle dans le set :** c'est le **hero** de toute la formation. Le seul avec l'emblème
play-button en médaillon de prestige. Les 5 covers de cours en dérivent (même palette,
même lumière) mais avec des sujets distincts.

---

## 🎨 Palette verrouillée TPB deep-gold — à respecter au hex près

| Rôle | Hex | Usage dans l'image |
|---|---|---|
| Or primaire | `#FFD700` | corps du métal, dominante (~85 %) |
| Or clair (highlight) | `#FFE44D` / `#FFF6C2` | reflets spéculaires, arêtes éclairées haut-gauche |
| Or profond (ombre) | `#9A6608` / `#6E4804` | creux, biseaux, dessous |
| Bleu électrique (rim froid) | `#3B82F6` | rim-light **uniquement** sur le bord bas-droit |
| Violet (accent) | `#A855F7` | **1 seule** facette, touche discrète |
| Fond noir chaud | `#1D1E1A` | fond studio (jamais noir pur) |
| Quasi-blanc | `#FAFAFA` | pointe de spéculaire max |

**Règle DA (commune aux 6 thumbs) :** l'or domine (~85 %), le bleu est un rim-light froid
**net** (pas un mélange) sur le bas-droit, le violet est **une pointe** sur une seule facette.
Fond `#1D1E1A`. Éclairage clé studio **haut-gauche**. Rendu 3D photoréaliste (octane),
sujet **centré/légèrement à droite**, silhouette nette, **grand espace négatif à gauche**
(pour poser un titre par-dessus dans le LMS). Cadrage **16:9 cinématique**. Aucun texte.

## 💡 Concept

L'**emblème play-button** (triangle = « The Play Button ») élevé au rang de **médaillon de
mastery / crête d'académie**. Ce n'est pas un logo posé : c'est un objet **usiné, massif,
premium**, éclairé comme un produit de luxe. Il dit : *formation d'élite, sérieuse, qui se
mérite*. C'est le seul thumb qui montre le triangle en entier et en héros.

## ⭐ Prompt principal (recommandé)

```
Cinematic 16:9 hero cover for a premium sales mastery program.
Subject: a single hero EMBLEM at the center-right — a bold equilateral
PLAY TRIANGLE machined in polished-and-brushed GOLD (primary #FFD700,
bright top-left highlights #FFE44D and #FAFAFA, deep shadows #9A6608 and
#6E4804 in the bevels), pointing right, encircled by a thin radiant ring
with subtle laurel-like grooves so it reads as a prestige graduation
medallion. The emblem rests on a low obsidian pedestal with a soft golden
reflection beneath it. A cool electric-blue rim-light (#3B82F6) grazes
ONLY the lower-right edge of the ring; one single faint violet glint
(#A855F7) catches one facet of the triangle. Background: warm near-black
#1D1E1A studio seamless, soft top-left key light, gentle radial vignette,
a few floating gold-dust particles, large empty negative space on the
LEFT third for a title overlay. Material: premium anodized gold, fine
radial machining grooves, tasteful specular sheen — luxurious, not gaudy.
Photoreal 3D product render, octane, high detail, elite enterprise
aesthetic. No text, no letters, no watermark.
--ar 16:9 --v 6 --style raw --q 2
```

## 🏅 Variante A — médaille / coin frappé (plus « diplôme »)

```
Cinematic 16:9 cover. A heavy golden commemorative MEDALLION seen at a
slight three-quarter angle, its face bearing a deeply struck PLAY
TRIANGLE, milled edges and a laurel wreath embossed around the rim.
Polished gold #FFD700 with #FFE44D / #FAFAFA highlights on the upper-left
relief and #9A6608 shadows in the struck recesses. Cool blue rim-light
#3B82F6 only along the lower-right edge, one violet #A855F7 glint on a
single laurel leaf. Warm near-black #1D1E1A studio background, soft
top-left key light, subtle contact shadow, gold particles, generous
negative space on the left. Photoreal 3D render, high detail, premium.
No text, no letters, no watermark. --ar 16:9 --v 6 --style raw --q 2
```

## 🎬 Variante B — emblème sur scène (plus « académie »)

```
Cinematic 16:9 cover. A tall golden PLAY-TRIANGLE emblem standing upright
on a dark reflective stage, catching a single dramatic top-left
spotlight, as if unveiled on the stage of a masterclass. Polished gold
#FFD700, hot highlights #FFE44D / #FAFAFA on the lit facet, deep #9A6608
shadow on the shaded side. A cool blue #3B82F6 rim traces the lower-right
edge; one violet #A855F7 spark at the tip. Volumetric haze, warm
near-black #1D1E1A hall, soft floor reflection, wide empty space to the
left. Photoreal cinematic 3D render, octane, high detail. No text, no
letters, no watermark. --ar 16:9 --v 6 --style raw --q 2
```

## 🚫 Negative prompt (SDXL / Flux / outils qui le supportent)

```
text, letters, words, numbers, watermark, logo signature, apple logo,
fruit, flat vector, cartoon, low detail, blurry, noisy, cluttered
background, pure black background, neon glow overload, rainbow, plastic
toy look, oversaturated, extra objects, hands, faces, busy foreground
```

## 📐 Notes d'usage (valables pour tout le set)

- Génère ce cover **en premier**, garde la meilleure sortie, puis **fige son `--seed`** et
  réutilise-le sur les 5 covers de cours → set homogène.
- En Midjourney, ajoute `--sref <url de ce cover>` sur les 5 autres pour verrouiller le style.
- Adapte la syntaxe selon l'outil : `--ar/--v/--style/--q/--seed/--sref` = Midjourney. Pour
  DALL·E 3 / Ideogram / ChatGPT, **supprime les `--flags`** et garde `16:9`. Pour SDXL/Flux,
  ajoute le **negative prompt**.
- Upscale ≥ 1600 px de large. Garde l'espace négatif **à gauche** intact (titre LMS).
- Fais 4-8 variations, garde la gagnante (PNG), nettoie la palette au hex près, puis câble
  dans le LMS (`mediaJson` IMAGE du Program).
