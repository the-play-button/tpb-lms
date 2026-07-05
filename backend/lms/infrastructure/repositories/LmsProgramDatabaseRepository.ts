/**
 * LmsProgramDatabaseRepository — D1 implementation of the LmsProgramRepository port
 * (Plan 10). Plain row DTO; a program is a simple aggregate root (grouping of courses).
 */
import type {
  LmsProgramRepository,
  ProgramRow,
  CreateProgramData,
  UpdateProgramPatch,
} from '../../domain/repositories/LmsProgramRepository.js';

const j = (v: unknown): string | null => (v === undefined || v === null ? null : JSON.stringify(v));

export class LmsProgramDatabaseRepository implements LmsProgramRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<ProgramRow | null> {
    return (await this.db.prepare('SELECT * FROM lms_program WHERE id = ?').bind(id).first<ProgramRow>()) ?? null;
  }

  async insert(data: CreateProgramData): Promise<ProgramRow> {
    await this.db
      .prepare(
        `INSERT OR IGNORE INTO lms_program (id, name, description, media_json, is_active, raw_json)
         VALUES (?, ?, ?, ?, 1, ?)`,
      )
      .bind(data.id, data.name, data.description ?? null, j(data.mediaJson), j(data.rawJson))
      .run();
    const row = await this.findById(data.id);
    if (!row) throw new Error(`LmsProgramDatabaseRepository.insert: row ${data.id} not found after insert`);
    return row;
  }

  async update(id: string, patch: UpdateProgramPatch): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    const add = (col: string, v: unknown) => { sets.push(`${col} = ?`); vals.push(v); };
    if (patch.name !== undefined) add('name', patch.name);
    if (patch.description !== undefined) add('description', patch.description);
    if (patch.mediaJson !== undefined) add('media_json', j(patch.mediaJson));
    if (patch.isActive !== undefined) add('is_active', patch.isActive ? 1 : 0);
    if (patch.rawJson !== undefined) add('raw_json', j(patch.rawJson));
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    vals.push(id);
    await this.db.prepare(`UPDATE lms_program SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  }

  async delete(id: string): Promise<void> {
    await this.db.prepare('DELETE FROM lms_program WHERE id = ?').bind(id).run();
  }
}
