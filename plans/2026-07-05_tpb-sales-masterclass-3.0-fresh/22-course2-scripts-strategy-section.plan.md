# 22 — Course 2 (Outbound Mastery): add « Scripts & Strategy » section

## Contexte

Course `course_mc_2` "2 — Outbound Mastery" has ONE section (`sec_mc_2_1` "Outbound Mastery (Nick
Saraev)", video). On ADD une section **« Scripts & Strategy »** en réutilisant la **structure** de
Notion `3.2 Scripts n Strategy.md` (free hook → real proposal ; mix 50/50 multi-canal + cold call ;
séquence email/LinkedIn/vidéo ; hook cold-call + branches ; flow de conversion ; métriques ;
objection handling du free offer).

**Correctif cardinal (voir 20-overview § SSOT & sourcing doctrine)** : le contenu de 3.2 est
**offre + ICP périmés** (« free HubSpot audit », « 45 calls/day », dialer, SDR agency). On garde la
**forme**, on **repositionne le fond** sur la direction actuelle :
- Le **free hook** = le **diagnostic CRM gratuit** de l'offre actuelle (`c4-2` : « diagnostic is
  free » pour un Standard CRM). Fit naturel : la structure « free audit → real proposal » de 3.2
  MAPPE exactement sur « free diagnostic → CRM cleaning + ladder ».
- Le **real proposal** = le nettoyage CRM + les cinq produits (`c1-3`), pas le dialer.
- L'**ICP** = fabricants de textiles mid-market (pain : pipeline dormant, délivrabilité, ERP≠CRM
  façon WGE), pas SDR agency.
- Les **métriques** = gardées comme cibles de prospection génériques, débarrassées du « 45 calls ».

House voice = copywriting skill. Scripts en `> "..."` lift-and-use, métriques en tables. Zéro
em/en-dash, zéro citation, **zéro vieux hook/ICP/produit**.

## Fichiers impactés

- READ : `_content/c4-2-who-we-sell-to.md` (offre + free diagnostic + triggers + buckets), `c4-1-what-we-sell.md`
- CREATE `.../_content/c2s-1-prospecting-strategy.md` (free diagnostic hook → cleaning proposal ; mix 50/50)
- CREATE `.../_content/c2s-2-multi-channel-sequence.md` (email 1 free diagnostic, email 2 real proposal, LinkedIn, video email + script, vers un fabricant de textiles)
- CREATE `.../_content/c2s-3-cold-call-playbook.md` (hook + branches « not interested / send info / interested », offre actuelle)
- CREATE `.../_content/c2s-4-free-diagnostic-and-conversion.md` (le diagnostic gratuit de c4-2 comme process + flow de conversion + métriques + objections du free offer)
- MODIFY `import_masterclass.py` (course_mc_2 : append 1 section tuple)

## Étapes

1. Read c4-2 (free diagnostic, buckets, triggers) + c4-1 pour ancrer l'offre.
2. Read Notion 3.2 **pour la structure** (séquence, branches, flow, métriques).
3. Author c2s-1..c2s-4, structure de 3.2, fond = offre CRM-cleaning + niche textile ; scripts en
   blockquotes, métriques en tables ; garder les merge tokens `{{FirstName}}` dans les blocs.
4. In `import_masterclass.py`, inside `course_mc_2`, après `sec_mc_2_1`, append :
   ```python
   ("sec_mc_2_2", "Scripts & Strategy", [
       ("les_mc_2_2_1", "Our Prospecting Strategy", CONTENT / "c2s-1-prospecting-strategy.md"),
       ("les_mc_2_2_2", "The Multi-Channel Sequence", CONTENT / "c2s-2-multi-channel-sequence.md"),
       ("les_mc_2_2_3", "The Cold-Call Playbook", CONTENT / "c2s-3-cold-call-playbook.md"),
       ("les_mc_2_2_4", "The Free Diagnostic & Conversion Flow", CONTENT / "c2s-4-free-diagnostic-and-conversion.md"),
   ]),
   ```
5. `python3 scripts/masterclass-import/import_masterclass.py` → `errors 0`.
6. Live verify tpb-browser on `course_mc_2` : 2 sections ; les 4 leçons rendent scripts + tables ;
   **grep = zéro « HubSpot audit » (SDR sense) / « 45 calls » / « Phone Burster » / « SDR agency »** ;
   zéro em/en-dash + citation ; 0 console error.
7. Write `22-...plan.done.md`.

## Risques identifiés

- **Recopier le hook SDR verbatim** → risque. Mitigation : le hook devient le diagnostic CRM
  gratuit (déjà dans c4-2) ; grep anti-vieux-hook en step 6.
- Merge tokens `{{...}}` cassés par markdown → les garder dans code/blockquote.

## Critères de validation

- `course_mc_2` : 2 sections ; 4 leçons rendues avec scripts + métriques.
- Zéro « HubSpot audit » (au sens SDR) / « 45 calls » / « Phone Burster » / « SDR agency ».
- Le hook = diagnostic CRM gratuit ; le real proposal = cleaning + cinq produits.
- `import_masterclass.py` errors 0 ; zéro em/en-dash + citation ; 0 console error. Section Nick intacte.
