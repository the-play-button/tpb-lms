# Thumbnail — Cours 4 « The Offer »

**Généré :** 2026-07-05
**Méthode :** image générative (ChatGPT / DALL·E, Midjourney, ou Flux), raster.
**Cible LMS :** cover du **Course** `course_mc_4` — `mediaJson` IMAGE, ratio **16:9**.
**Palette & règle DA :** identiques au set (cf. `00-program-tpb-sales-academy.md`). Or dominant
`#FFD700`, rim bleu `#3B82F6` bas-droit uniquement, pointe violet `#A855F7`, fond `#1D1E1A`.

---

## 🎨 Palette verrouillée (rappel)

| Rôle | Hex |
|---|---|
| Or primaire | `#FFD700` |
| Or clair (highlight) | `#FFE44D` / `#FFF6C2` |
| Or profond (ombre) | `#9A6608` / `#6E4804` |
| Bleu électrique (rim froid) | `#3B82F6` |
| Violet (accent) | `#A855F7` |
| Fond noir chaud | `#1D1E1A` |
| Quasi-blanc | `#FAFAFA` |

## 💡 Concept

L'**offre unique** (grand-slam offer façon Hormozi) : une **valeur si forte qu'elle paraît
irrésistible**. Symbole : un **coffret doré** entrouvert d'où **jaillit une lumière chaude** et
quelques étincelles de valeur, avec une **étiquette de valeur** flottante. Registre : **valeur
irrésistible, générosité, récompense.** C'est le thumb le plus **rayonnant** du set (la lumière
vient de l'intérieur du sujet).

## ⭐ Prompt principal (recommandé)

```
Cinematic 16:9 course cover about crafting one irresistible grand-slam
offer. Subject: a luxurious golden GIFT BOX at the center, its lid
slightly ajar, with warm radiant light and a few floating sparks
spilling out from inside, and a single minimalist blank VALUE TAG
floating beside it on a thin thread. The box is polished gold (primary
#FFD700, crisp top-left highlights #FFE44D / #FAFAFA on the lid edges,
deep #9A6608 shadow on the shaded side and inside the seam) with a subtle
ribbon. The main light source is the warm golden glow from WITHIN the
open box; a cool electric-blue rim-light (#3B82F6) grazes ONLY the lower-
right outer corner; a single faint violet spark (#A855F7) among the ones
escaping. Background: warm near-black #1D1E1A studio, gentle bokeh around
the glow, generous negative space on the LEFT for a title. Mood:
irresistible value, generosity, reward. Photoreal premium 3D product
render, octane, high detail. No text, no letters, no watermark.
--ar 16:9 --v 6 --style raw --q 2
```

## 💎 Variante A — diamant / joyau de valeur (plus « valeur brute »)

```
Cinematic 16:9 cover. A single large faceted GOLDEN GEM floating on a
dark pedestal, radiating warm internal light through its facets — the
distilled value of one great offer. Polished gold #FFD700 with hot
#FFE44D / #FAFAFA speculars on the top-left facets and #9A6608 depth in
the deeper cuts. A cool blue #3B82F6 rim on the lower-right facet, one
violet #A855F7 inner glow. Warm near-black #1D1E1A studio, soft top-left
key light, gold-dust bokeh, empty space on the left. Photoreal 3D render,
high detail, caustics. No text, no letters, no watermark.
--ar 16:9 --v 6 --style raw --q 2
```

## ⚖️ Variante B — balance valeur/prix (plus « no-brainer »)

```
Cinematic 16:9 cover. An elegant golden BALANCE SCALE where one heavy
side overflowing with glowing gold light and small golden shapes clearly
outweighs a tiny coin on the other side — value far greater than price, a
no-brainer offer. Polished gold #FFD700, #FFE44D / #FAFAFA highlights,
#9A6608 shadows. Cool blue #3B82F6 rim on the lower-right arm, one violet
#A855F7 glint. Warm near-black #1D1E1A background, soft top-left key
light, gentle particles, negative space on the left. Photoreal 3D render,
octane, high detail. No text, no letters, no watermark.
--ar 16:9 --v 6 --style raw --q 2
```

## 🚫 Negative prompt (SDXL / Flux)

```
text, letters, words, numbers, price digits, watermark, logo, flat
vector, cartoon, low detail, blurry, noisy, cluttered background, pure
black background, neon overload, rainbow, plastic toy look,
oversaturated, extra objects, hands, faces
```

## 📐 Notes d'usage

- Réutilise le **`--seed`** figé du cover programme (+ `--sref <url programme>`).
- La lumière vient **de l'intérieur** du sujet — laisse l'espace négatif **à gauche** plus sombre
  pour le titre LMS. Upscale ≥ 1600 px.
- DALL·E/Ideogram : retire les `--flags`, garde `16:9`. SDXL/Flux : ajoute le negative prompt.
