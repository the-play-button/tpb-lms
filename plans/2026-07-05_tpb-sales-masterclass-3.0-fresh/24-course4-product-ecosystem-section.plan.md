# 24 — Course 4 (The Offer): add « Product & Ecosystem » section

## Contexte

Course `course_mc_4` "4 — The Offer" has ONE section (`sec_mc_4_1` "The Offer", c4-1..c4-7). We ADD a
section from Notion section 2 (Product & Ecosystem), currently absent from the LMS entirely:
- `2.1 Product deep-dive.md` (1176w, marked "A RELIRE" + uses OLD product names) — reconcile to LMS naming.
- `2.2 Demo use-cases.md` (1585w)
- `2.3 Integrations.md` (1449w)
- `2.4 Customer stories.md` (1510w)
- `2.5 Product limitations.md` (1413w)

**Product-naming reconciliation (décision 20, no user question)**: the LMS already ships the product
framing in `c1-3 One Offer, Five Products` + `c4-1 The Brutal CRM Truth` + `c4-7 the Five Products`.
Rewrite section 2 to that naming; drop old "TPB Sales Assistant / Phone Burster" labels. Read c1-3 +
c4-1 + c4-7 first to lock the canonical product/module names before authoring.

House voice = copywriting skill. Keep the concrete use-cases, integration list, customer numbers,
and honest limitations verbatim-useful (tables). Zero em/en-dash, zero citation.

## Fichiers impactés

- READ (for naming): `_content/c1-3-one-offer-five-products.md`, `c4-1-what-we-sell.md`, `c4-7-delivery-routing.md`
- CREATE `.../_content/c4p-1-product-deep-dive.md` (from Notion 2.1, reconciled naming)
- CREATE `.../_content/c4p-2-demo-use-cases.md` (from 2.2)
- CREATE `.../_content/c4p-3-integrations.md` (from 2.3)
- CREATE `.../_content/c4p-4-customer-stories.md` (from 2.4)
- CREATE `.../_content/c4p-5-limitations.md` (from 2.5)
- MODIFY `import_masterclass.py` (course_mc_4 block: append 1 section tuple)

## Étapes

1. Read c1-3 + c4-1 + c4-7 → extract the canonical product + five-products names.
2. Read Notion 2.1→2.5.
3. Author c4p-1..c4p-5 in house voice, mapping old product names → LMS canonical names, keeping
   use-cases / integrations / customer numbers / limitations verbatim-useful.
4. In `import_masterclass.py`, inside `course_mc_4`, after `sec_mc_4_1`, append:
   ```python
   ("sec_mc_4_2", "Product & Ecosystem", [
       ("les_mc_4_2_1", "Product Deep-Dive", CONTENT / "c4p-1-product-deep-dive.md"),
       ("les_mc_4_2_2", "Demo Use-Cases", CONTENT / "c4p-2-demo-use-cases.md"),
       ("les_mc_4_2_3", "Integrations", CONTENT / "c4p-3-integrations.md"),
       ("les_mc_4_2_4", "Customer Stories", CONTENT / "c4p-4-customer-stories.md"),
       ("les_mc_4_2_5", "Where It Stops (Limitations)", CONTENT / "c4p-5-limitations.md"),
   ]),
   ```
5. `python3 scripts/masterclass-import/import_masterclass.py` → `errors 0`.
6. Live verify tpb-browser on `course_mc_4`: section "Product & Ecosystem" present with 5 lessons;
   tables render; **grep for old names** ("Phone Burster", "TPB Sales Assistant") = none; zero
   em/en-dash + citation; 0 console error.
7. Write `24-...plan.done.md`.

## Risques identifiés

- 2.1 is marked DRAFT + has old product names → reconciliation is the core work; verify no old name
  leaks (explicit grep in step 6).
- Customer stories may name real/placeholder companies → keep only what's consistent with c4 stories;
  don't invent logos.

## Critères de validation

- `course_mc_4` shows 2 sections; 5 product lessons reachable and rendered.
- Zero occurrence of "Phone Burster" / "TPB Sales Assistant" in the 5 new lessons.
- `import_masterclass.py` errors 0; zero em/en-dash + citation; 0 console error (tpb-browser).
- c4-1..c4-7 intact.
