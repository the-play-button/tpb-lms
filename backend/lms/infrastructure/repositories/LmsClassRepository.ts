/**
 * LmsClassRepository — D1 CRUD for lms_class (content-authoring write layer).
 *
 * lms_class is an adjacency-list tree (migration 006): parent_class_id self-FK +
 * node_kind (SECTION | LESSON). deleteSubtree uses a recursive CTE.
 */

export type NodeKind = 'SECTION' | 'LESSON';

export interface ClassRow {
  id: string;
  course_id: string;
  parent_class_id: string | null;
  node_kind: NodeKind;
  name: string;
  description: string | null;
  media_json: string | null;
  sys_order_index: number;
  raw_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateClassData {
  id: string;
  courseId: string;
  parentClassId?: string | null;
  nodeKind: NodeKind;
  name: string;
  description?: string | null;
  mediaJson?: unknown;
  sysOrderIndex?: number;
  rawJson?: unknown;
}

export interface UpdateClassPatch {
  name?: string;
  description?: string | null;
  mediaJson?: unknown;
  sysOrderIndex?: number;
  parentClassId?: string | null;
  nodeKind?: NodeKind;
  rawJson?: unknown;
}

const j = (v: unknown): string | null => (v === undefined || v === null ? null : JSON.stringify(v));

export class LmsClassRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<ClassRow | null> {
    return (await this.db
      .prepare('SELECT * FROM lms_class WHERE id = ?')
      .bind(id)
      .first<ClassRow>()) ?? null;
  }

  async findByCourse(courseId: string): Promise<ClassRow[]> {
    const res = await this.db
      .prepare('SELECT * FROM lms_class WHERE course_id = ? ORDER BY sys_order_index ASC')
      .bind(courseId)
      .all<ClassRow>();
    return res.results ?? [];
  }

  /** Idempotent by id: INSERT OR IGNORE then return the row. */
  async insert(data: CreateClassData): Promise<ClassRow> {
    await this.db
      .prepare(
        `INSERT OR IGNORE INTO lms_class
           (id, course_id, parent_class_id, node_kind, name, description, media_json, sys_order_index, raw_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        data.id,
        data.courseId,
        data.parentClassId ?? null,
        data.nodeKind,
        data.name,
        data.description ?? null,
        j(data.mediaJson),
        data.sysOrderIndex ?? 0,
        j(data.rawJson),
      )
      .run();
    const row = await this.findById(data.id);
    if (!row) throw new Error(`LmsClassRepository.insert: row ${data.id} not found after insert`);
    return row;
  }

  async update(id: string, patch: UpdateClassPatch): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    const add = (col: string, v: unknown) => { sets.push(`${col} = ?`); vals.push(v); };
    if (patch.name !== undefined) add('name', patch.name);
    if (patch.description !== undefined) add('description', patch.description);
    if (patch.mediaJson !== undefined) add('media_json', j(patch.mediaJson));
    if (patch.sysOrderIndex !== undefined) add('sys_order_index', patch.sysOrderIndex);
    if (patch.parentClassId !== undefined) add('parent_class_id', patch.parentClassId);
    if (patch.nodeKind !== undefined) add('node_kind', patch.nodeKind);
    if (patch.rawJson !== undefined) add('raw_json', j(patch.rawJson));
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    vals.push(id);
    await this.db.prepare(`UPDATE lms_class SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  }

  /** Collect a node + all its descendants (adjacency-list) via recursive CTE. */
  async collectSubtreeIds(id: string): Promise<string[]> {
    const res = await this.db
      .prepare(
        `WITH RECURSIVE sub(id) AS (
           SELECT id FROM lms_class WHERE id = ?1
           UNION ALL
           SELECT c.id FROM lms_class c JOIN sub ON c.parent_class_id = sub.id
         )
         SELECT id FROM sub`,
      )
      .bind(id)
      .all<{ id: string }>();
    return (res.results ?? []).map((r) => r.id);
  }

  /** Delete a node and its entire subtree. Returns the number of rows deleted. */
  async deleteSubtree(id: string): Promise<number> {
    const ids = await this.collectSubtreeIds(id);
    if (ids.length === 0) return 0;
    const placeholders = ids.map(() => '?').join(',');
    await this.db.prepare(`DELETE FROM lms_class WHERE id IN (${placeholders})`).bind(...ids).run();
    return ids.length;
  }

  async deleteByCourse(courseId: string): Promise<void> {
    await this.db.prepare('DELETE FROM lms_class WHERE course_id = ?').bind(courseId).run();
  }
}
