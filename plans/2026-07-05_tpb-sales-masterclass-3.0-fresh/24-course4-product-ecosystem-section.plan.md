# 24 — Course 4 (The Offer): add « The Five Products & How They Fit »

## Contexte

**Correctif cardinal (voir 20-overview § SSOT & sourcing doctrine)** : la Notion section 2 décrit
l'**ancien produit dialer** (« TPB Sales Assistant / Phone Burster ») — **périmé**. Le SSOT du
« produit » aujourd'hui est la leçon **live** `c1-3` : **une offre** (« wake up your dormant
pipeline ») + **cinq produits** (CRM cleaning, outreach, sales reactivation, ABM paid ads, ABM
email), ladder **clean → sales → ABM** ; + `c4-7` (delivery / five products). On ne recopie **pas**
le deep-dive dialer 2.1.

Ce plan ajoute au cours `course_mc_4` une section **« The Five Products & How They Fit »** qui
détaille les cinq produits actuels (rôle, place dans le ladder, quand un client les obtient) + les
intégrations CRM. Seule source Notion réutilisée : **2.3 Integrations** (HubSpot / Salesforce /
Pipedrive — toujours pertinent pour le CRM cleaning), **reframée** sur l'offre actuelle. 2.1 (dialer
deep-dive) = **droppé**. 2.2 demo use-cases / 2.4 customer stories / 2.5 limitations = réutilisés
seulement si reframables sur l'offre CRM-cleaning + WGE, sinon écartés (pas de vieux produit).

House voice = copywriting skill. Zéro em/en-dash, zéro citation, **zéro vieux nom produit**.

## Fichiers impactés

- READ : `_content/c1-3-one-offer-five-products.md`, `c4-1-what-we-sell.md`, `c4-7-delivery-routing.md` (SSOT produit actuel)
- CREATE `.../_content/c4p-1-the-five-products.md` (chaque produit : ce qu'il fait, sa place dans le ladder clean→sales→ABM, quand un client l'obtient)
- CREATE `.../_content/c4p-2-integrations.md` (Notion 2.3 reframée : HubSpot/Salesforce/Pipedrive + le pont ERP↔CRM façon WGE, au niveau CRM-cleaning)
- CREATE `.../_content/c4p-3-where-it-stops.md` (limites honnêtes de l'offre actuelle, reframe de 2.5 si utile ; sinon dérivé de c4-1/c4-2)
- MODIFY `import_masterclass.py` (course_mc_4 : append 1 section tuple après sec_mc_4_1)

## Étapes

1. Read c1-3 + c4-1 + c4-7 → verrouiller les cinq produits + le ladder + le vocabulaire actuel.
2. Read Notion 2.3 (integrations) pour la matière intégrations ; scan 2.2/2.4/2.5 et ne garder que
   ce qui est reframable sur l'offre CRM-cleaning (jeter tout ce qui parle du dialer).
3. Author c4p-1..c4p-3 en house-voice, 100% aligné sur les cinq produits actuels.
4. In `import_masterclass.py`, inside `course_mc_4`, après `sec_mc_4_1`, append :
   ```python
   ("sec_mc_4_2", "The Five Products & How They Fit", [
       ("les_mc_4_2_1", "The Five Products", CONTENT / "c4p-1-the-five-products.md"),
       ("les_mc_4_2_2", "Integrations", CONTENT / "c4p-2-integrations.md"),
       ("les_mc_4_2_3", "Where It Stops", CONTENT / "c4p-3-where-it-stops.md"),
   ]),
   ```
5. `python3 scripts/masterclass-import/import_masterclass.py` → `errors 0`.
6. Live verify tpb-browser on `course_mc_4` : section « The Five Products & How They Fit », 3 leçons ;
   **grep = zéro « Phone Burster » / « TPB Sales Assistant » / « dialer » comme produit** ; les cinq
   produits de c1-3 apparaissent ; zéro em/en-dash + citation ; 0 console error.
7. Write `24-...plan.done.md`.

## Risques identifiés

- **Ré-enshriner l'ancien produit** → risque majeur. Mitigation : source = c1-3/c4-7 (SSOT), pas
  Notion 2.1 ; grep explicite anti-vieux-noms en step 6.
- Dup avec c4-1 (what we sell) / c4-7 (delivery five products) → cette section est le **détail par
  produit** ; c4-1 reste le « what we sell » outcome-led, c4-7 la delivery. Pas de triple copie ;
  si recouvrement, un seul endroit détaille (§ BIG BANG).

## Critères de validation

- `course_mc_4` : section « The Five Products & How They Fit », 3 leçons rendues.
- Zéro occurrence de « Phone Burster » / « TPB Sales Assistant » (comme produit vendu) dans les leçons.
- Les cinq produits (CRM cleaning, outreach, sales reactivation, ABM paid ads, ABM email) présents.
- `import_masterclass.py` errors 0 ; zéro em/en-dash + citation ; 0 console error.
