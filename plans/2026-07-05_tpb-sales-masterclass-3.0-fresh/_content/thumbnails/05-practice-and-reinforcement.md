# Thumbnail — Cours 5 « Practice & Reinforcement »

**Généré :** 2026-07-05
**Méthode :** image générative (ChatGPT / DALL·E, Midjourney, ou Flux), raster.
**Cible LMS :** cover du **Course** `course_mc_5` — `mediaJson` IMAGE, ratio **16:9**.
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

Cours pratique : roleplay, shadowing, KPIs, coaching — **la maîtrise par la répétition**.
Symbole : des **marches dorées qui montent** (progression) enlacées d'une **flèche en boucle**
(itération), avec une **étincelle** au sommet (le palier atteint). Registre : **discipline,
amélioration, momentum par les reps.** Thumb à **lecture ascendante** (gauche → droite, bas → haut).

## ⭐ Prompt principal (recommandé)

```
Cinematic 16:9 course cover about mastery through practice and
repetition. Subject: three glossy golden STEPS or platforms rising from
lower-left to upper-right, wrapped by a smooth circular LOOP ARROW that
threads around them (iteration, reps), with a small bright warm SPARK of
light on the top step signaling a level reached. Polished gold (primary
#FFD700, crisp top-left highlights #FFE44D / #FAFAFA on the step edges,
deep #9A6608 shadow beneath each step). A cool electric-blue rim-light
(#3B82F6) grazes ONLY the lower-right step edge; a single faint violet
glow (#A855F7) in the spark. Background: warm near-black #1D1E1A studio,
soft radial glow behind the steps, faint gold particles, generous
negative space on the LEFT for a title. Mood: disciplined, improving,
momentum through reps. Photoreal 3D render, octane, slight isometric
angle, high detail. No text, no letters, no watermark.
--ar 16:9 --v 6 --style raw --q 2
```

## 🔁 Variante A — boucle d'amélioration (plus « itération »)

```
Cinematic 16:9 cover. A polished golden circular LOOP ARROW spiraling
upward like a rising helix, each turn slightly higher and brighter than
the last, a warm spark at its top end — the compounding of repeated
practice. Gold #FFD700 with #FFE44D / #FAFAFA speculars on the top-left
of each coil and #9A6608 shadow underneath. Cool blue #3B82F6 rim on the
lower-right coil, one violet #A855F7 glow at the tip. Warm near-black
#1D1E1A studio, soft top-left key light, gold bokeh, empty space on the
left. Photoreal 3D render, high detail, depth of field. No text, no
letters, no watermark. --ar 16:9 --v 6 --style raw --q 2
```

## 🏆 Variante B — sommet atteint (plus « maîtrise »)

```
Cinematic 16:9 cover. A golden ascending path or staircase leading the
eye up to a small radiant golden SUMMIT marker glowing at the top-right,
a subtle upward trail of light climbing the steps — reaching mastery.
Polished gold #FFD700, #FFE44D / #FAFAFA highlights, #9A6608 shadows.
Cool blue #3B82F6 rim on the lower-right edge, one violet #A855F7 glow at
the summit. Warm near-black #1D1E1A background, volumetric haze, soft
top-left key light, wide negative space in the lower-left. Photoreal
cinematic 3D render, octane, high detail. No text, no letters, no
watermark. --ar 16:9 --v 6 --style raw --q 2
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
- Lecture **ascendante** : garde le titre LMS **en bas-gauche** (là où c'est le plus sombre).
  Upscale ≥ 1600 px.
- DALL·E/Ideogram : retire les `--flags`, garde `16:9`. SDXL/Flux : ajoute le negative prompt.
