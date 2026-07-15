/**
 * CoursesService — list/get course aggregation with translations + progress.
 */

import { resolveProgressionMode } from './_progressionMode.js';
import type { Env } from "../../types/Env.js";

type Translations = Record<string, string>;

interface MediaItem {
    type?: string;
    url?: string;
    [key: string]: unknown;
}

/** Row shape of the localized `lms_class` join (queryCourseClasses). */
interface CoursesClassRow {
    id: string;
    name?: string;
    description?: string;
    media_json?: string | null;
    raw_json?: string | null;
    sys_order_index?: number | null;
    parent_class_id?: string | null;
    node_kind?: string | null;
    video_completed?: number;
    quiz_passed?: number;
    video_max_position_sec?: number | null;
    video_duration_sec?: number | null;
    [key: string]: unknown;
}

/** Row shape of `lms_course` (queryActiveCourses / queryCourseById). */
interface CoursesCourseRow {
    id: string;
    name?: string;
    description?: string;
    categories_json?: string | null;
    is_private?: number;
    media_json?: string | null;
    program_id?: string | null;
    raw_json?: string | null;
    [key: string]: unknown;
}

interface EnrichedClass {
    id: string;
    name?: string;
    description?: string;
    order_index: number;
    media: MediaItem[];
    step_type: string;
    content_md: string;
    video_completed: boolean;
    quiz_passed: boolean;
    step_completed: boolean;
    can_access: boolean;
    [key: string]: unknown;
}

const loadTranslations = async (env: Env, contentType: string, contentId: string, lang: string): Promise<Translations> => {
    const result = await env.DB.prepare(`
        SELECT field, value FROM translations
        WHERE content_type = ? AND content_id = ? AND lang = ?
    `).bind(contentType, contentId, lang).all<{ field: string; value: string }>();
    const map: Translations = {};
    for (const row of result.results || []) map[row.field] = row.value;
    return map;
};

const applyTranslations = <T extends Record<string, unknown>>(obj: T, translations: Translations): T => {
    if (!translations || Object.keys(translations).length === 0) return obj;
    const result = { ...obj } as Record<string, unknown>;
    for (const [field, value] of Object.entries(translations)) {
        if (field === 'name' && result.title !== undefined) result.title = value;
        if (result[field] !== undefined) result[field] = value;
    }
    return result as T;
};

const enrichMedia = (media: MediaItem, videoCompleted: boolean, quizPassed: boolean, cls: CoursesClassRow): MediaItem => {
    if (media.type === 'VIDEO') {
        const coveragePct = cls.video_duration_sec
            ? Math.round(((cls.video_max_position_sec ?? 0) / cls.video_duration_sec) * 100)
            : 0;
        return { ...media, completed: videoCompleted, coverage_pct: coveragePct };
    }
    if (media.type === 'QUIZ') return { ...media, passed: quizPassed };
    return media;
};

const enrichClass = (cls: CoursesClassRow, currentStep: number): EnrichedClass => {
    const mediaItems: MediaItem[] = cls.media_json ? (JSON.parse(cls.media_json) as MediaItem[]) : [];
    const raw: Record<string, unknown> = cls.raw_json ? (JSON.parse(cls.raw_json) as Record<string, unknown>) : {};
    const hasQuiz = mediaItems.some((m: MediaItem) => m.type === 'QUIZ');
    const videoCompleted = cls.video_completed === 1;
    const quizPassed = cls.quiz_passed === 1;
    const stepCompleted = videoCompleted && (!hasQuiz || quizPassed);
    const orderIndex = cls.sys_order_index ?? 0;
    return {
        id: cls.id,
        name: cls.name,
        description: cls.description,
        order_index: orderIndex,
        media: mediaItems.map((m: MediaItem) => enrichMedia(m, videoCompleted, quizPassed, cls)),
        step_type: (raw.tpb_step_type as string) || 'CONTENT',
        content_md: (raw.tpb_content_md as string) || '',
        video_completed: videoCompleted,
        quiz_passed: quizPassed,
        step_completed: stepCompleted,
        can_access: orderIndex <= currentStep + 1,
    };
};

const queryActiveCourses = (env: Env) =>
    env.DB.prepare(`
        SELECT id, name, description, categories_json, is_private, media_json, program_id, sys_order_index
        FROM lms_course WHERE is_active = 1 ORDER BY sys_order_index ASC, name ASC
    `).all();

// First IMAGE media url = the course cover (uploaded as media_json IMAGE). null when
// absent → the classroom card falls back to its deterministic gradient.
const extractCoverImageUrl = (mediaJson: string | null | undefined): string | null => {
    if (!mediaJson) return null;
    try {
        const media: unknown = JSON.parse(mediaJson);
        return Array.isArray(media)
            ? ((media as MediaItem[]).find((m) => m?.type === 'IMAGE')?.url ?? null)
            : null;
    } catch {
        return null;
    }
};

const queryCourseStepCount = (env: Env, courseId: string) =>
    env.DB.prepare("SELECT COUNT(*) as count FROM lms_class WHERE course_id = ? AND node_kind = 'LESSON'").bind(courseId).first<{ count: number }>();

const queryCourseProgress = (env: Env, userId: string, courseId: string) =>
    env.DB.prepare(`
        SELECT SUM(video_completed) as videos_completed, SUM(quiz_passed) as quizzes_passed
        FROM v_user_progress WHERE user_id = ? AND course_id = ?
    `).bind(userId, courseId).first<{ videos_completed: number | null; quizzes_passed: number | null }>();

const enrichCourseSummary = async (env: Env, course: CoursesCourseRow, userId: string, lang: string) => {
    const [stepCount, progress] = await Promise.all([
        queryCourseStepCount(env, course.id),
        queryCourseProgress(env, userId, course.id),
    ]);

    let result = {
        id: course.id,
        title: course.name,
        description: course.description,
        categories: course.categories_json ? JSON.parse(course.categories_json) : [],
        is_private: course.is_private === 1,
        cover_image_url: extractCoverImageUrl(course.media_json),
        program_id: course.program_id ?? null,
        total_steps: stepCount?.count || 0,
        progress: {
            videos_completed: progress?.videos_completed || 0,
            quizzes_passed: progress?.quizzes_passed || 0,
        },
    };

    if (lang) {
        const translations = await loadTranslations(env, 'course', course.id, lang);
        result = applyTranslations(result, translations);
    }

    return result;
};

export const listCoursesForUser = async (env: Env, userId: string, lang: string): Promise<{
    courses: {
        id: string;
        title: string | undefined;
        description: string | undefined;
        categories: unknown;
        is_private: boolean;
        cover_image_url: string | null;
        program_id: string | null;
        total_steps: number;
        progress: {
            videos_completed: number;
            quizzes_passed: number;
        };
    }[];
}>  => {
    const courses = await queryActiveCourses(env);
    const rows = (courses.results || []) as unknown as CoursesCourseRow[];  // entropy-no-unsafe-type-assertion-ok: D1 query .results is untyped unknown[] at the CF D1 vendor boundary — cast to the row type is the DB-adapter ACL edge
    const enriched = await Promise.all(
        rows.map((course) => enrichCourseSummary(env, course, userId, lang))
    );
    return { courses: enriched };
};

const queryCourseById = (env: Env, courseId: string) =>
    env.DB.prepare('SELECT * FROM lms_course WHERE id = ? AND is_active = 1')
        .bind(courseId).first<CoursesCourseRow>();

const queryCourseClasses = (env: Env, userId: string, courseId: string) =>
    env.DB.prepare(`
        SELECT c.id, c.name, c.description, c.media_json,
            c.sys_order_index, c.raw_json,
            c.parent_class_id, c.node_kind,
            COALESCE(p.video_completed, 0) as video_completed,
            COALESCE(p.quiz_passed, 0) as quiz_passed,
            p.video_max_position_sec, p.video_duration_sec
        FROM lms_class c
        LEFT JOIN v_user_progress p ON p.class_id = c.id AND p.user_id = ?
        WHERE c.course_id = ? ORDER BY c.sys_order_index ASC
    `).bind(userId, courseId).all();

const applyCourseTranslations = async (env: Env, courseId: string, lang: string, baseTitle: string | undefined, baseDescription: string | undefined) => {
    if (!lang) return { title: baseTitle, description: baseDescription };
    const translations = await loadTranslations(env, 'course', courseId, lang);
    return {
        title: translations.name ?? baseTitle,
        description: translations.description ?? baseDescription,
    };
};

const applyClassTranslations = async (env: Env, enrichedClasses: EnrichedClass[], lang: string): Promise<EnrichedClass[]> => {
    if (!lang) return enrichedClasses;
    return Promise.all(enrichedClasses.map(async (cls) => {
        const classTranslations = await loadTranslations(env, 'class', cls.id, lang);
        return applyTranslations(cls, classTranslations);
    }));
};

// ---- Nested sections (migration 006): adjacency-list tree over lms_class ----
// Rows are grouped by parent_class_id; siblings ordered by sys_order_index.
// SECTION nodes are folders; LESSON nodes are leaves carrying media + progress.
const ROOT_KEY = '__root';

type Adjacency = Map<string, CoursesClassRow[]>;

const buildAdjacency = (rows: CoursesClassRow[]): Adjacency => {
    const byParent: Adjacency = new Map();
    for (const row of rows) {
        const key = row.parent_class_id || ROOT_KEY;
        let siblings = byParent.get(key);
        if (!siblings) { siblings = []; byParent.set(key, siblings); }
        siblings.push(row);
    }
    for (const siblings of byParent.values()) {
        siblings.sort((a, b) => (a.sys_order_index ?? 0) - (b.sys_order_index ?? 0));
    }
    return byParent;
};

// Depth-first traversal → ordered flat list of LESSON leaf rows (the global step
// sequence used for sequential progress / can_access gating).
const flattenLessonsDFS = (byParent: Adjacency, key = ROOT_KEY, acc: CoursesClassRow[] = []): CoursesClassRow[] => {
    for (const row of byParent.get(key) || []) {
        if ((row.node_kind || 'LESSON') === 'LESSON') acc.push(row);
        flattenLessonsDFS(byParent, row.id, acc);
    }
    return acc;
};

// Enrich the DFS-ordered lesson rows, assigning a GLOBAL step index by position
// (sys_order_index is now per-sibling, so array position is the true ordinal).
const enrichLessonSequence = (lessonRows: CoursesClassRow[]): EnrichedClass[] => {
    let currentStep = 0;
    const enrichedSteps = lessonRows.map((cls, i) => {
        const e = enrichClass(cls, currentStep);
        e.order_index = i;
        if (e.step_completed) currentStep = Math.max(currentStep, i);
        return e;
    });
    return enrichedSteps.map((e) => ({ ...e, can_access: e.order_index <= currentStep + 1 }));
};

// Build the display tree: SECTION folders + LESSON leaves (enriched/localized).
const buildDisplayTree = (byParent: Adjacency, lessonById: Map<string, EnrichedClass>, sectionNameById: Map<string, string>, key = ROOT_KEY): unknown[] =>
    (byParent.get(key) || []).map((row) => {
        const kind = row.node_kind || 'LESSON';
        if (kind === 'SECTION') {
            return {
                id: row.id,
                name: sectionNameById.get(row.id) ?? row.name,
                description: row.description,
                node_kind: 'SECTION',
                order_index: row.sys_order_index ?? 0,
                children: buildDisplayTree(byParent, lessonById, sectionNameById, row.id),
            };
        }
        return {
            ...(lessonById.get(row.id) || { id: row.id, name: row.name }),
            node_kind: 'LESSON',
            children: buildDisplayTree(byParent, lessonById, sectionNameById, row.id),
        };
    });

const translateSectionNames = async (env: Env, sectionRows: CoursesClassRow[], lang: string): Promise<Map<string, string>> => {
    const map = new Map<string, string>();
    if (!lang) return map;
    await Promise.all(sectionRows.map(async (row) => {
        const t = await loadTranslations(env, 'class', row.id, lang);
        if (t.name) map.set(row.id, t.name);
    }));
    return map;
};

export const getCourseForUser = async (env: Env, userId: string, courseId: string, lang: string): Promise<{
    notFound: boolean;
    body?: undefined;
} | {
    notFound: boolean;
    body: {
        id: string;
        title: string | undefined;
        description: string | undefined;
        categories: unknown;
        progression_mode: string;
        nodes: unknown[];
        classes: EnrichedClass[];
        progress: {
            total_steps: number;
            completed_steps: number;
            current_step: number;
            can_access_step: number;
        };
    };
}>  => {
    const course = await queryCourseById(env, courseId);
    if (!course) return { notFound: true };

    const classesResult = await queryCourseClasses(env, userId, courseId);
    const rows = (classesResult.results || []) as unknown as CoursesClassRow[];  // entropy-no-unsafe-type-assertion-ok: D1 query .results is untyped unknown[] at the CF D1 vendor boundary — cast to the row type is the DB-adapter ACL edge
    const byParent = buildAdjacency(rows);

    // Flat LESSON sequence (progress) + section folders (display).
    const lessonRows = flattenLessonsDFS(byParent);
    const enrichedLessons = enrichLessonSequence(lessonRows);
    const localizedLessons = await applyClassTranslations(env, enrichedLessons, lang);
    const lessonById = new Map<string, EnrichedClass>(localizedLessons.map((l) => [l.id, l]));

    const sectionRows = rows.filter((r) => (r.node_kind || 'LESSON') === 'SECTION');
    const sectionNameById = await translateSectionNames(env, sectionRows, lang);

    const nodes = buildDisplayTree(byParent, lessonById, sectionNameById);
    const localizedCourse = await applyCourseTranslations(env, courseId, lang, course.name, course.description);

    const completedSteps = localizedLessons.filter((l) => l.step_completed).length;
    const currentStepIndex = completedSteps;
    const progressionMode = resolveProgressionMode(course.raw_json);
    const total = localizedLessons.length;

    return {
        notFound: false,
        body: {
            id: course.id,
            title: localizedCourse.title,
            description: localizedCourse.description,
            categories: course.categories_json ? JSON.parse(course.categories_json) : [],
            // 'linear' (default onboarding) | 'free' (Skool-style navigation).
            progression_mode: progressionMode,
            // Tree of SECTION folders + LESSON leaves (display structure).
            nodes,
            // Flat DFS-ordered LESSON leaves (sequential progress + back-compat).
            classes: localizedLessons,
            progress: {
                total_steps: total,
                completed_steps: completedSteps,
                current_step: currentStepIndex,
                can_access_step: progressionMode === 'free' ? total : Math.min(currentStepIndex + 1, total),
            },
        },
    };
};
