/**
 * Shared UPDATE-set builder for the LMS D1 repositories (LmsClass / LmsCourse /
 * LmsProgram). Factors the identical sets/vals/add scaffold + updated_at stamp +
 * parameterized UPDATE that was duplicated across the three repositories'
 * `update()` methods. No-op when no field changed.
 */

/** JSON-stringify a value for a `*_json` D1 column (null-safe). */
export const j = (v: unknown): string | null =>
  v === undefined || v === null ? null : JSON.stringify(v);

/**
 * Collect `col = ?` assignments via the `add` callback (call it only for defined
 * patch fields — lazy, so JSON serialization runs only for present columns),
 * append `updated_at`, and run the parameterized UPDATE against `table`.
 */
export const runPatchUpdate = async (
  db: D1Database,
  table: string,
  id: string,
  build: (add: (col: string, val: unknown) => void) => void,
): Promise<void> => {
  const sets: string[] = [];
  const vals: unknown[] = [];
  build((col, val) => {
    sets.push(`${col} = ?`);
    vals.push(val);
  });
  if (sets.length === 0) return;
  sets.push("updated_at = datetime('now')");
  vals.push(id);
  await db.prepare(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
};
