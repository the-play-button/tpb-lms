# Plan 03 — Nested sections : extension ERD adjacency-list sur `lms_class`

> **Premier plan exécuté** de l'initiative (les autres consomment ce modèle).

## Contexte

`lms_class` ne fait que 2 niveaux (`lms_course` → `lms_class`) + un soft-label
`raw_json.tpb_section`. Impossible de reproduire l'arbre Skool de Nick Saraev
(Course → "Month 1" → "Week 1" → leçons). Notre propre `db/schema.sql` fait
pourtant déjà de l'adjacency-list nesting : `kms_space.parent_space_id`,
`kms_page.parent_page_id`, `hris_group.parent_id`. On applique le même pattern à
`lms_class`. C'est le premier plan exécuté (02 et 04 en dépendent).

## Objectif

Donner à `lms_class` une hiérarchie de profondeur arbitraire, comme Skool /
Teachable / Kajabi. On applique le pattern adjacency-list **déjà blessé et utilisé
dans notre propre `db/schema.sql`** : `kms_space.parent_space_id`,
`kms_page.parent_page_id`, `hris_group.parent_id`.

## Design retenu (élégant, zéro nouvelle table)

`lms_class` devient un arbre. Deux colonnes ajoutées :

- `parent_class_id TEXT REFERENCES lms_class(id)` — self-FK. `NULL` = nœud
  top-level directement sous le course.
- `node_kind TEXT NOT NULL DEFAULT 'LESSON'` — `SECTION` (nœud de regroupement,
  dossier, pas de média) | `LESSON` (feuille avec `media_json`).

`sys_order_index` **existe déjà** → ordonne les frères d'un même niveau.
`course_id` reste sur chaque nœud (root pointer dénormalisé, subtree queries
scopées au course — exactement comme `kms_page` porte `space_id` + `parent_page_id`).

Pourquoi self-FK plutôt qu'une table `lms_section` dédiée :
- Un seul type de nœud, un seul arbre, profondeur illimitée. Une table `lms_section`
  séparée fragmenterait l'arbre sur 2 tables (impossible d'avoir une leçon
  directement sous un course sans section, ou une sous-section propre).
- Cohérent avec les 3 précédents maison (kms_space/kms_page/hris_group).
- Le soft-label `raw_json.tpb_section` (2 niveaux bricolés) est promu en vrais
  nœuds `SECTION`.

## Étapes

1. **Migration schema** `006_nested_sections.sql` : `ALTER TABLE` (2 colonnes) +
   index.
2. **schema.sql canonique** : ajouter les colonnes + index à `lms_class`, retirer
   le commentaire `tpb_section`.
3. **Backfill** `006_backfill_sections.js` : plat → arbre, promotion des labels
   `tpb_section` en nœuds SECTION, re-parentage des leçons, nettoyage du label
   (idempotent).
4. **Lecture arbre** : adapter `getCourse` (HydrateContext/Filter) pour renvoyer
   `nodes[]` nestés.
5. **Doc** : mettre à jour `schema.erd.md`.
6. **Smoke** : migration locale + backfill sur dump + GET arbre.

## Migration `db/migrations/006_nested_sections.sql`

```sql
-- Nested sections : lms_class devient un arbre adjacency-list.
-- Pattern déjà utilisé pour kms_space/kms_page/hris_group dans ce même schema.
ALTER TABLE lms_class ADD COLUMN parent_class_id TEXT REFERENCES lms_class(id);
ALTER TABLE lms_class ADD COLUMN node_kind TEXT NOT NULL DEFAULT 'LESSON';  -- SECTION | LESSON

CREATE INDEX IF NOT EXISTS idx_lms_class_parent
    ON lms_class(parent_class_id, sys_order_index);
```

Mettre à jour `db/schema.sql` (le CREATE TABLE canonique de `lms_class`) pour
inclure les 2 colonnes + l'index + retirer le commentaire deprecated
`tpb_section` (remplacé par les vrais nœuds SECTION). Garder `course_id` sur
chaque nœud.

## Backfill (data migration)

Script `db/migrations/006_backfill_sections.js` (ou intégré au déploiement) :

1. Toutes les `lms_class` existantes : `parent_class_id = NULL`,
   `node_kind = 'LESSON'` (un arbre plat est un arbre valide → zéro régression).
2. Pour chaque valeur distincte de `raw_json.tpb_section` dans un course donné :
   créer un nœud `SECTION` (`node_kind='SECTION'`, `parent_class_id=NULL`,
   `name=<valeur tpb_section>`, `sys_order_index` = ordre d'apparition), puis
   re-parenter les leçons qui portaient ce label → `parent_class_id = <id du SECTION>`.
3. Nettoyer `raw_json.tpb_section` (label devenu redondant).

> Idempotent : re-run détecte les SECTION déjà créés (par `name` + `course_id` +
> `node_kind='SECTION'`) et ne duplique pas.

## Lecture — GET course renvoie l'arbre

`getCourse` (`GET /api/courses/:courseId`) : le HydrateContext charge toutes les
`lms_class` du course, le Filter/Execute reconstruit l'arbre (nest les enfants
par `parent_class_id`, ordonne par `sys_order_index`). Shape de sortie :

```json
{
  "id": "course_x",
  "name": "...",
  "nodes": [
    { "id": "sec_1", "nodeKind": "SECTION", "name": "Month 1", "children": [
        { "id": "sec_1a", "nodeKind": "SECTION", "name": "Week 1", "children": [
            { "id": "les_1", "nodeKind": "LESSON", "name": "...", "mediaJson": [...] }
        ]}
    ]}
  ]
}
```

## ERD doc

Mettre à jour `schema.erd.md` : documenter `lms_class` comme arbre adjacency-list,
retirer la mention "2-level only" + `tpb_section` soft-label.

## Fichiers

- `db/migrations/006_nested_sections.sql` — `ALTER TABLE` (2 colonnes) + index.
- `db/migrations/006_backfill_sections.js` — backfill idempotent
  `tpb_section` → nœuds SECTION.
- `db/schema.sql` — CREATE TABLE `lms_class` canonique : ajouter `parent_class_id`
  + `node_kind` + `idx_lms_class_parent`, retirer le commentaire `tpb_section`.
- `schema.erd.md` — documenter l'arbre adjacency-list, retirer "2-level only".
- `getCourse` HydrateContext/Filter — reconstruction de l'arbre nesté.
- `03-nested-sections-erd-adjacency-list.plan.after.py` — sidecar assertions.

## Critères

- `db/schema.sql` contient `parent_class_id`, `node_kind`, `idx_lms_class_parent`
  sur `lms_class`.
- Migration `006` appliquée en local sans erreur.
- Backfill idempotent : 2e run → 0 nouveau SECTION.
- `GET /api/courses/:id` renvoie une structure `nodes[]` nestée (pas plate),
  ordonnée par `sys_order_index`.
- Zéro régression : les rows existantes deviennent `parent_class_id=NULL` +
  `node_kind='LESSON'` (arbre plat = arbre valide).

## Risques

- **Backfill destructif** : re-parenter les leçons + nettoyer `raw_json.tpb_section`
  doit être idempotent et testé sur un dump AVANT prod. Sauvegarder un dump D1
  avant exécution.
- **SQLite ADD COLUMN NOT NULL** : `node_kind TEXT NOT NULL DEFAULT 'LESSON'` est OK
  (DEFAULT fourni). `parent_class_id` reste nullable — OK.
- **Requête d'arbre coûteuse** : sur un gros course, reconstruire l'arbre en
  mémoire depuis une liste plate est O(n) — acceptable ; l'index
  `(parent_class_id, sys_order_index)` couvre le tri par niveau.

## Vérification

```bash
cd Apps/the-play-button/tpb-lms
# appliquer la migration en local (D1 local) + rejouer le backfill sur un dump
npx wrangler d1 execute <db> --local --file db/migrations/006_nested_sections.sql
# smoke : créer sec>sec>lesson, GET course → arbre correct, ordre respecté
```

## Sidecar assertions

`03-nested-sections-erd-adjacency-list.plan.after.py` :
- assert `db/schema.sql` contient `parent_class_id` + `node_kind` + `idx_lms_class_parent` sur `lms_class`.
- assert migration `006` existe.
- assert backfill idempotent (2e run → 0 nouveau SECTION).
- assert `getCourse` renvoie une structure `nodes[]` nestée (pas une liste plate).
