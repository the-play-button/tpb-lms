import type { Env } from "../../types/Env.js";

/**
 * ProgramsService — read model for lms_program (Plan 10). A program groups N courses
 * (Program → Course → Section → Lesson). Thin read layer, mirrors CoursesService.
 */

interface ProgramRow { id: string; name?: string; description?: string; media_json?: string | null; }
interface ProgramCountRow { program_id: string; n?: number; }

const extractCoverImageUrl = (mediaJson: string | null | undefined): string | null => {
    if (!mediaJson) return null;
    try {
        const media = JSON.parse(mediaJson) as unknown;
        return Array.isArray(media)
            ? ((media as Array<{ type?: string; url?: string }>).find((m) => m?.type === 'IMAGE')?.url ?? null)
            : null;
    } catch {
        return null;
    }
};

/**
 * List active programs with cover + course count. Cheap: one query for programs, one
 * grouped count for course membership.
 */
export const listProgramsForUser = async (env: Env) => {
    const [programsRes, countsRes] = await Promise.all([
        env.DB.prepare('SELECT id, name, description, media_json FROM lms_program WHERE is_active = 1 ORDER BY name ASC').all<ProgramRow>(),
        env.DB.prepare("SELECT program_id, COUNT(*) AS n FROM lms_course WHERE is_active = 1 AND program_id IS NOT NULL GROUP BY program_id").all<ProgramCountRow>(),
    ]);
    const countById: Record<string, number | undefined> = {};
    for (const row of countsRes.results || []) countById[row.program_id] = row.n;
    const programs = (programsRes.results || []).map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        cover_image_url: extractCoverImageUrl(p.media_json),
        course_count: countById[p.id] || 0,
    }));
    return { programs };
};
