/**
 * LmsCourseDatabaseRepository — D1 implementation of the LmsCourseRepository port.
 * Plain row DTOs (no entity reconstitution): a course is a simple aggregate root.
 */
import type {
  LmsCourseRepository,
  CourseRow,
  CreateCourseData,
  UpdateCoursePatch,
} from '../../domain/repositories/LmsCourseRepository.js';

const j = (v: unknown): string | null => (v === undefined ? null : v === null ? null : JSON.stringify(v));

export class LmsCourseDatabaseRepository implements LmsCourseRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<CourseRow | null> {
    return (await this.db
      .prepare('SELECT * FROM lms_course WHERE id = ?')
      .bind(id)
      .first<CourseRow>()) ?? null;
  }

  async insert(data: CreateCourseData): Promise<CourseRow> {
    await this.db
      .prepare(
        `INSERT OR IGNORE INTO lms_course
           (id, name, description, categories_json, media_json, is_active, is_private, languages_json, raw_json)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      )
      .bind(
        data.id,
        data.name,
        data.description ?? null,
        j(data.categoriesJson),
        j(data.mediaJson),
        data.isPrivate ? 1 : 0,
        j(data.languagesJson),
        j(data.rawJson),
      )
      .run();
    const row = await this.findById(data.id);
    if (!row) throw new Error(`LmsCourseDatabaseRepository.insert: row ${data.id} not found after insert`);
    return row;
  }

  async update(id: string, patch: UpdateCoursePatch): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    const add = (col: string, v: unknown) => { sets.push(`${col} = ?`); vals.push(v); };
    if (patch.name !== undefined) add('name', patch.name);
    if (patch.description !== undefined) add('description', patch.description);
    if (patch.categoriesJson !== undefined) add('categories_json', j(patch.categoriesJson));
    if (patch.mediaJson !== undefined) add('media_json', j(patch.mediaJson));
    if (patch.isActive !== undefined) add('is_active', patch.isActive ? 1 : 0);
    if (patch.isPrivate !== undefined) add('is_private', patch.isPrivate ? 1 : 0);
    if (patch.languagesJson !== undefined) add('languages_json', j(patch.languagesJson));
    if (patch.programId !== undefined) add('program_id', patch.programId);
    if (patch.rawJson !== undefined) add('raw_json', j(patch.rawJson));
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    vals.push(id);
    await this.db.prepare(`UPDATE lms_course SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  }

  async delete(id: string): Promise<void> {
    await this.db.prepare('DELETE FROM lms_course WHERE id = ?').bind(id).run();
  }
}
