# 25 — Course 4 (The Offer): add « First Niche: Textile Manufacturers »

## Contexte

**Correctif cardinal (voir 20-overview § SSOT & sourcing doctrine)** : on ne cible plus « External
SDR Agency ». Le SSOT de l'ICP est la leçon **live** `c4-2` : B2B, US, mid-market (50+ employés,
5 000+ contacts CRM), CRM sale, 6 triggers, 3 buckets, **référence WGE** (fabricant industriel
mid-market, ERP + CRM multi-source). **On démarre par UN avatar : les fabricants de textiles**
(décision user 2026-07-06, cohérent avec WGE).

Ce plan ajoute au cours `course_mc_4` une section **« First Niche: Textile Manufacturers »**. On
réutilise la **méthode** de profilage de la Notion section 6 (lexique métier, pain points, buying
triggers, objections) — **PAS son contenu SDR verbatim** — appliquée aux fabricants de textiles +
l'offre CRM-cleaning actuelle.

**Sourcing (pas de fabrication)** : aucun matériel de positionnement textile n'existe dans le repo
(constat grep 2026-07-06). Le contenu se dérive de (a) le modèle de douleur de l'offre actuelle
(`c4-2` : délivrabilité, pipeline dormant, ERP+CRM multi-source façon WGE) + (b) une **passe de
recherche desk légère** sur les fabricants de textiles mid-market B2B (structure go-to-market,
stack typique, cycles d'achat). Le lexique/pain/triggers dérivés sont **flaggés pour validation
user** dans le `.done.md` (« à confirmer avec un vrai fabricant de textiles »). On n'invente **pas**
un faux lexique insider ; si la profondeur manque, on écrit `.partial.md` + question.

Course already has `c4-2 Who We Sell To` (ICP overview). This section is the **niche drill-down** ;
`c4-2` reste l'overview (§ BIG BANG — un overview + un deep, pas deux overviews).

Dépend de : Plan 24 appliqué avant (même bloc course_mc_4 ; append après `sec_mc_4_2`).

## Fichiers impactés

- READ : `_content/c4-2-who-we-sell-to.md` (SSOT ICP, dedup boundary)
- CREATE `.../_content/c4i-1-the-textile-world.md` (comment un fabricant de textiles va au marché : structure, stack ERP+CRM typique, vocabulaire métier dérivé + recherche desk)
- CREATE `.../_content/c4i-2-their-pain.md` (la douleur CRM/sales d'un fabricant de textiles : base sale, pipeline dormant, délivrabilité, ERP≠CRM)
- CREATE `.../_content/c4i-3-buying-triggers.md` (quand un fabricant de textiles achète le nettoyage CRM — mappe les 6 triggers de c4-2 à la réalité textile)
- CREATE `.../_content/c4i-4-icp-objections.md` (objections spécifiques d'un fabricant de textiles + réponses, structure des objection loops)
- MODIFY `import_masterclass.py` (course_mc_4 : append 1 section tuple après sec_mc_4_2)

## Étapes

1. Read `c4-2` (ICP actuel + triggers + buckets) pour ancrer et éviter la dup.
2. Read Notion 6.1/6.2/6.3/6.4 **pour la MÉTHODE uniquement** (comment on structure lexique / pain /
   triggers / objections), pas le contenu SDR.
3. Passe de recherche desk légère sur les fabricants de textiles B2B mid-market (structure,
   go-to-market, stack, cycles) — noter les sources.
4. Author c4i-1..c4i-4 en house-voice, ancrés sur l'offre CRM-cleaning + la réalité textile.
   **Zéro** « SDR agency », « Phone Burster », « 45 calls/day », « HubSpot audit » SDR.
5. In `import_masterclass.py`, inside `course_mc_4`, après `sec_mc_4_2`, append :
   ```python
   ("sec_mc_4_3", "First Niche: Textile Manufacturers", [
       ("les_mc_4_3_1", "The Textile Manufacturer's World", CONTENT / "c4i-1-the-textile-world.md"),
       ("les_mc_4_3_2", "Their Pain", CONTENT / "c4i-2-their-pain.md"),
       ("les_mc_4_3_3", "Buying Triggers", CONTENT / "c4i-3-buying-triggers.md"),
       ("les_mc_4_3_4", "Niche-Specific Objections", CONTENT / "c4i-4-icp-objections.md"),
   ]),
   ```
6. `python3 scripts/masterclass-import/import_masterclass.py` → `errors 0`.
7. Live verify tpb-browser on `course_mc_4` : section « First Niche: Textile Manufacturers » avec 4
   leçons ; tables rendues ; **grep = zéro « SDR agency » / « Phone Burster »** ; zéro em/en-dash +
   citation ; 0 console error.
8. Write `25-...plan.done.md` — **avec la liste explicite des affirmations textile à valider par le
   user** (section « À confirmer »).

## Risques identifiés

- **Pas de source textile** → risque de fabrication. Mitigation : dériver de l'offre + recherche
  desk sourcée, flag validation user. Si la profondeur métier est insuffisante pour être honnête
  → `.partial.md` + question, pas de bourrage.
- Dup avec c4-2 → c4-2 reste l'overview, cette section est le deep textile ; pas deux copies.

## Critères de validation

- `course_mc_4` : section « First Niche: Textile Manufacturers », 4 leçons rendues.
- Zéro occurrence de « SDR agency » / « Phone Burster » / « 45 calls » dans les 4 leçons.
- `import_masterclass.py` errors 0 ; zéro em/en-dash + citation ; 0 console error.
- `.done.md` liste les affirmations textile à valider (honnêteté du sourcing).
