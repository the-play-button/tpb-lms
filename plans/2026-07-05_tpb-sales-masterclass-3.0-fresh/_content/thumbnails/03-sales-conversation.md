# Thumbnail — Cours 3 « Sales Conversation »

**Généré :** 2026-07-05
**Méthode :** image générative (ChatGPT / DALL·E, Midjourney, ou Flux), raster.
**Cible LMS :** cover du **Course** `course_mc_3` — `mediaJson` IMAGE, ratio **16:9**.
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

Cours C.L.O.S.E.R : discovery, objections, closing — **l'art de la conversation 1:1**, « la voix
humaine est sacrée ». Symbole : **deux bulles de dialogue dorées** qui s'emboîtent, avec une
**onde sonore** lumineuse à l'intérieur de l'une (la voix). Registre : **humain, confiance,
connexion one-to-one.** C'est le thumb le plus **chaleureux/relationnel** du set.

## ⭐ Prompt principal (recommandé)

```
Cinematic 16:9 course cover about the art of the one-to-one sales
conversation. Subject: two elegant interlocking SPEECH BUBBLES gently
overlapping at the center, sculpted in polished gold (primary #FFD700,
soft top-left highlights #FFE44D / #FAFAFA, deep #9A6608 shadow where
they overlap); inside the front bubble a delicate glowing SOUNDWAVE
ripples in warm gold light — the human voice. Warm reflections curve
across their glossy surfaces. A cool electric-blue rim-light (#3B82F6)
grazes ONLY the lower-right bubble edge; a single faint violet glint
(#A855F7) on one soundwave peak. Background: warm near-black #1D1E1A
studio, soft radial halo behind the bubbles, faint gold particles,
generous negative space on the LEFT for a title. Mood: human, trusted,
warm, one-to-one connection. Photoreal 3D render, octane, soft studio
shadows, high detail, tasteful. No text, no letters, no watermark.
--ar 16:9 --v 6 --style raw --q 2
```

## 🎧 Variante A — casque + onde (plus « call »)

```
Cinematic 16:9 cover. A refined golden HEADSET with a boom mic floating
at the center, a glowing gold SOUNDWAVE flowing out of the mic across the
frame — the sacred human voice on a call. Polished gold #FFD700, #FFE44D
/ #FAFAFA speculars on the top-left, #9A6608 shadows in the cushions. A
cool blue #3B82F6 rim on the lower-right band, one violet #A855F7 glint
on a soundwave peak. Warm near-black #1D1E1A studio, soft top-left key
light, subtle bokeh, empty space on the left. Photoreal 3D render, high
detail, depth of field. No text, no letters, no watermark.
--ar 16:9 --v 6 --style raw --q 2
```

## 🤝 Variante B — deux formes qui se rejoignent (plus « connexion »)

```
Cinematic 16:9 cover. Two smooth golden abstract half-forms leaning
toward each other and almost touching at the center, a bright warm spark
of light igniting in the small gap between them — two people connecting
in a conversation. Polished gold #FFD700 with #FFE44D / #FAFAFA
highlights and #9A6608 shadows. Cool blue #3B82F6 rim on the lower-right
form, one violet #A855F7 glow in the spark. Warm near-black #1D1E1A
background, soft top-left key light, gentle particles, wide negative
space left. Photoreal cinematic 3D render, octane, high detail. No text,
no letters, no watermark. --ar 16:9 --v 6 --style raw --q 2
```

## 🚫 Negative prompt (SDXL / Flux)

```
text, letters, words, numbers, watermark, logo, flat vector, cartoon,
low detail, blurry, noisy, cluttered background, pure black background,
neon overload, rainbow, plastic toy look, oversaturated, extra objects,
hands, faces
```

## 📐 Notes d'usage

- Réutilise le **`--seed`** figé du cover programme (+ `--sref <url programme>`).
- Garde l'espace négatif **à gauche** (titre LMS). Upscale ≥ 1600 px.
- DALL·E/Ideogram : retire les `--flags`, garde `16:9`. SDXL/Flux : ajoute le negative prompt.
