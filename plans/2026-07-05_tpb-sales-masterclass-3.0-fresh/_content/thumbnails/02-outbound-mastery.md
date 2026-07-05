# Thumbnail — Cours 2 « Outbound Mastery »

**Généré :** 2026-07-05
**Méthode :** image générative (ChatGPT / DALL·E, Midjourney, ou Flux), raster.
**Cible LMS :** cover du **Course** `course_mc_2` — `mediaJson` IMAGE, ratio **16:9**.
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

Cours cold-outbound (Nick Saraev) : **atteindre des inconnus** avec précision, du copywriting
qui **atterrit**. Symbole : un **avion en papier doré** qui décolle en diagonale et laisse une
**traînée de lumière** courbe vers une **cible** lointaine. Registre : **précis, confiant,
momentum** — l'outreach qui touche juste. C'est le thumb le plus **dynamique** du set (mouvement).

## ⭐ Prompt principal (recommandé)

```
Cinematic 16:9 course cover about cold outbound and copywriting that
lands. Subject: a sleek golden PAPER AIRPLANE launching diagonally from
lower-left toward upper-right, leaving a smooth glowing arc of light
behind it that curves toward a small distant glowing TARGET RING in the
upper-right. The plane is polished metallic gold (primary #FFD700, sharp
top-left highlights #FFE44D / #FAFAFA on the crisp folds, deep #9A6608
shadow under the wings). The light-trail is warm gold; a cool electric-
blue rim-light (#3B82F6) grazes ONLY the plane's lower-right trailing
edge; one faint violet glint (#A855F7) on the nose. Background: warm
near-black #1D1E1A studio, soft radial glow along the flight path, faint
drifting particles, empty negative space in the lower-left corner.
Mood: precise, confident, momentum. Photoreal 3D render, octane, dynamic
motion, shallow depth of field, high detail. No text, no letters, no
watermark. --ar 16:9 --v 6 --style raw --q 2
```

## 🎯 Variante A — flèche dans la cible (plus « précision »)

```
Cinematic 16:9 cover. A polished golden ARROW that has just struck the
exact bullseye of a floating concentric TARGET, the target rings machined
in gold with a dark recessed center. Gold #FFD700 with #FFE44D / #FAFAFA
speculars on the top-left rings and #9A6608 shadows in the grooves. A
cool blue #3B82F6 rim on the lower-right ring, one violet #A855F7 glint
on the arrow shaft. Warm near-black #1D1E1A background, soft top-left key
light, subtle impact glow, gold particles, negative space on the left.
Photoreal 3D render, high detail. No text, no letters, no watermark.
--ar 16:9 --v 6 --style raw --q 2
```

## ✉️ Variante B — enveloppe + signal (plus « email »)

```
Cinematic 16:9 cover. A golden ENVELOPE floating and slightly open, a
thin ribbon of glowing gold light escaping from it and arcing across the
frame toward a distant small glowing dot, like a message reaching exactly
the right person. Polished gold #FFD700, #FFE44D / #FAFAFA highlights,
#9A6608 inner shadow. Cool blue #3B82F6 rim on the lower-right edge, one
violet #A855F7 accent on the seal. Warm near-black #1D1E1A studio, soft
top-left key light, gentle bokeh, empty space lower-left. Photoreal 3D
render, octane, high detail, depth of field. No text, no letters, no
watermark. --ar 16:9 --v 6 --style raw --q 2
```

## 🚫 Negative prompt (SDXL / Flux)

```
text, letters, words, numbers, watermark, logo, flat vector, cartoon,
low detail, blurry, motion-blur smear, noisy, cluttered background,
pure black background, neon overload, rainbow, plastic toy look,
oversaturated, hands, faces
```

## 📐 Notes d'usage

- Réutilise le **`--seed`** figé du cover programme (+ `--sref <url programme>`).
- Ici le sujet part **du bas-gauche** — garde le titre LMS **en bas ou à gauche**, pas dans la
  traînée. Upscale ≥ 1600 px.
- DALL·E/Ideogram : retire les `--flags`, garde `16:9`. SDXL/Flux : ajoute le negative prompt.
