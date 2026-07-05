# Thumbnail — Cours 1 « Vision & Context »

**Généré :** 2026-07-05
**Méthode :** image générative (ChatGPT / DALL·E, Midjourney, ou Flux), raster.
**Cible LMS :** cover du **Course** `course_mc_1` — `mediaJson` IMAGE, ratio **16:9**.
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

Le cours pose la **vision BOSS** : un système d'orchestration **horizontal** qui copilote
**toutes les fonctions** de l'entreprise (GTM d'abord, puis RH/recrutement/finance/compta).
Symbole : un **noyau doré** au centre, entouré de **nœuds en orbite** reliés par de fins fils
de lumière — « un système qui copilote silencieusement chaque partie du business ». Registre :
**visionnaire, orchestral, calme et puissant.**

## ⭐ Prompt principal (recommandé)

```
Cinematic 16:9 course cover about a horizontal orchestration system that
copilots every function of a company. Subject: a glowing golden control
NUCLEUS — a polished translucent-gold sphere (primary #FFD700, hot
highlights #FFE44D / #FAFAFA on the top-left, deep #9A6608 core shadow)
hovering center-right, surrounded by dozens of small geometric nodes and
gears orbiting it in two or three concentric rings, connected by fine
luminous gold filaments and light trails — a quiet system linking every
part of a business. A cool electric-blue rim-light (#3B82F6) grazes ONLY
the lower-right nodes; a single faint violet glow (#A855F7) marks one
node. Background: warm near-black #1D1E1A studio, soft top-left key
light, gentle radial vignette, scattered gold-dust bokeh, large empty
negative space on the LEFT for a title. Mood: visionary, orchestral,
calm power. Photoreal enterprise-SaaS 3D render, octane, high detail,
tasteful. No text, no letters, no watermark. --ar 16:9 --v 6 --style raw --q 2
```

## 🌐 Variante A — constellation / réseau (plus « système »)

```
Cinematic 16:9 cover. A radiant golden hub sphere at the center with a
sprawling 3D NETWORK of thin gold light-lines fanning out to small
glowing golden nodes of different sizes, like a nervous system of a
company. Polished gold #FFD700, #FFE44D / #FAFAFA highlights, #9A6608
depth. Cool blue #3B82F6 rim on the lower-right lines only, one violet
#A855F7 node. Warm near-black #1D1E1A background, soft top-left key
light, gold bokeh, empty space on the left. Photoreal 3D render, high
detail, depth of field. No text, no letters, no watermark.
--ar 16:9 --v 6 --style raw --q 2
```

## 🧭 Variante B — chef d'orchestre abstrait (plus « vision »)

```
Cinematic 16:9 cover. A single luminous golden orb rising above a dark
surface, casting soft concentric rings of light outward that gently touch
rows of smaller golden shapes arranged like an audience of functions —
an abstract conductor commanding a system. Polished gold #FFD700 with
#FFE44D / #FAFAFA speculars and #9A6608 shadows. A cool blue #3B82F6 rim
on the lower-right ring, one violet #A855F7 accent. Warm near-black
#1D1E1A, volumetric haze, soft top-left key light, wide negative space
left. Photoreal cinematic 3D render, octane, high detail. No text, no
letters, no watermark. --ar 16:9 --v 6 --style raw --q 2
```

## 🚫 Negative prompt (SDXL / Flux)

```
text, letters, words, numbers, watermark, logo, flat vector, cartoon,
low detail, blurry, noisy, cluttered background, pure black background,
neon overload, rainbow, plastic toy look, oversaturated, hands, faces
```

## 📐 Notes d'usage

- Réutilise le **`--seed`** figé du cover programme (+ `--sref <url programme>` en Midjourney)
  pour rester dans le set.
- Espace négatif **à gauche** conservé (titre LMS). Upscale ≥ 1600 px.
- DALL·E/Ideogram : retire les `--flags`, garde `16:9`. SDXL/Flux : ajoute le negative prompt.
