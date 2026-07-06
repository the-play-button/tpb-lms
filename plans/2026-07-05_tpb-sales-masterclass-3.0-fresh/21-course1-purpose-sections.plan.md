# 21 — Course 1 (Vision & Context): add « Who We Serve » + « The Founder's Story »

## Contexte

Course `course_mc_1` "1 — Vision & Context" has ONE section:
`("sec_mc_1_1", "Vision & Context", [c1-1 the-vision, c1-2 how-companies-go-to-market, c1-3 one-offer-five-products])`.

On ADD deux sections.

**Correctif cardinal (voir 20-overview § SSOT & sourcing doctrine)** : la Notion `1.2 Target market`
décrit l'**ancien ICP** (SDR agency) — **périmé**. Le SSOT de « qui on sert » est la leçon **live**
`c4-2` : B2B, US, mid-market (50+ employés, 5 000+ contacts CRM), CRM sale, référence WGE. Et on
**démarre par les fabricants de textiles**. Donc la section « Who We Serve » est **dérivée de c4-2 +
la niche textile**, pas de Notion 1.2.

- **Who We Serve** = 1 leçon culture (course-1 niveau) : le marché qu'on sert (mid-market B2B au CRM
  sale), pourquoi ce marché, et **la première niche = fabricants de textiles**. Pointe vers le deep
  ICP du cours 4 (Plan 25) sans le dupliquer.
- **The Founder's Story** = Notion `1.4 Founder's narrative` **seulement si non-périmée** (pas
  d'ancien produit / ancien ICP) ; sinon reconstruire l'arc mission autour de la vision actuelle
  (BOSS, « la voix humaine est sacrée », IA-propose/humain-valide) déjà dans `c1-1`. À vérifier en
  lisant 1.4 en step 1 ; si polluée → dériver de c1-1 + recension.

House voice = copywriting skill. Zéro em/en-dash, zéro citation, **zéro vieux ICP/produit**.

## Fichiers impactés

- READ : `_content/c4-2-who-we-sell-to.md` (SSOT ICP), `c1-1-the-vision.md` (vision actuelle), Notion `1.4 Founder's narrative.md` (vérif péremption)
- CREATE `.../_content/c1-4-who-we-serve.md` (marché mid-market B2B + première niche textile, niveau culture)
- CREATE `.../_content/c1-5-the-founders-story.md` (arc mission, aligné vision actuelle)
- MODIFY `import_masterclass.py` (course_mc_1 : append 2 section tuples)

## Étapes

1. Read c4-2 (ICP SSOT) + c1-1 (vision) + Notion 1.4 (juger péremption).
2. Author `c1-4-who-we-serve.md` : le marché qu'on sert (dérivé de c4-2, niveau culture, pas le
   détail buckets), **la première niche = fabricants de textiles**, pointeur vers le deep (cours 4).
3. Author `c1-5-the-founders-story.md` : arc mission aligné à la vision actuelle ; si 1.4 est
   non-périmée, s'en inspirer ; sinon dériver de c1-1 + recension. Zéro vieux produit.
4. In `import_masterclass.py`, inside `course_mc_1`, après `sec_mc_1_1`, append :
   ```python
   ("sec_mc_1_2", "Who We Serve", [
       ("les_mc_1_2_1", "Who We Serve", CONTENT / "c1-4-who-we-serve.md"),
   ]),
   ("sec_mc_1_3", "The Founder's Story", [
       ("les_mc_1_3_1", "The Founder's Story", CONTENT / "c1-5-the-founders-story.md"),
   ]),
   ```
5. `python3 scripts/masterclass-import/import_masterclass.py` → `errors 0`.
6. Live verify tpb-browser on `course_mc_1` : 3 sections ; les 2 nouvelles leçons rendues ;
   **grep = zéro « SDR agency » / vieux produit** ; « textile » présent dans who-we-serve ; zéro
   em/en-dash + citation ; 0 console error.
7. Write `21-...plan.done.md`.

## Risques identifiés

- **Recopier l'ancien target market (SDR)** → risque. Mitigation : source = c4-2, pas Notion 1.2 ;
  grep anti-SDR en step 6.
- Founder narrative périmée → vérifier 1.4 avant usage ; dériver de c1-1 si polluée.
- Dup avec le deep ICP (Plan 25) → « Who We Serve » reste culture/haut-niveau + pointeur ; le détail
  vit dans le cours 4 (§ BIG BANG).

## Critères de validation

- `course_mc_1` : 3 sections ; 2 nouvelles leçons rendues.
- « textile » présent dans who-we-serve ; zéro « SDR agency » / vieux produit dans les 2 leçons.
- `import_masterclass.py` errors 0 ; zéro em/en-dash + citation ; 0 console error.
- c1-1/c1-2/c1-3 intacts.
