/**
 * CoursesService — list/get course aggregation with translations + progress.
 */

import { resolveProgressionMode } from './_progressionMode.js';

const loadTranslations = async (env, contentType, contentId, lang) => {
    const result = await env.DB.prepare(`
        SELECT field, value FROM translations
        WHERE content_type = ? AND content_id = ? AND lang = ?
    `).bind(contentType, contentId, lang).all();
    const map = {};
    for (const row of result.results || []) map[row.field] = row.value;
    return map;
};

const applyTranslations = (obj, translations) => {
    if (!translations || Object.keys(translations).length === 0) return obj;
    const result = { ...obj };
    for (const [field, value] of Object.entries(translations)) {
        if (field === 'name' && result.title !== undefined) result.title = value;
        if (result[field] !== undefined) result[field] = value;
    }
    return result;
};

const enrichMedia = (media, videoCompleted, quizPassed, cls) => {
    if (media.type === 'VIDEO') {
        const coveragePct = cls.video_duration_sec
            ? Math.round((cls.video_max_position_sec / cls.video_duration_sec) * 100)
            : 0;
        return { ...media, completed: videoCompleted, coverage_pct: coveragePct };
    }
    if (media.type === 'QUIZ') return { ...media, passed: quizPassed };
    return media;
};

const enrichClass = (cls, currentStep) => {
    const media = cls.media_json ? JSON.parse(cls.media_json) : [];
    const raw = cls.raw_json ? JSON.parse(cls.raw_json) : {};
    const hasQuiz = media.some(({ type } = {}) => type === 'QUIZ');
    const videoCompleted = cls.video_completed === 1;
    const quizPassed = cls.quiz_passed === 1;
    const stepCompleted = videoCompleted && (!hasQuiz || quizPassed);
    const orderIndex = cls.sys_order_index ?? 0;
    return {
        id: cls.id,
        name: cls.name,
        description: cls.description,
        order_index: orderIndex,
        media: media.map((m) => enrichMedia(m, videoCompleted, quizPassed, cls)),
        step_type: raw.tpb_step_type || 'CONTENT',
        content_md: raw.tpb_content_md || '',
        video_completed: videoCompleted,
        quiz_passed: quizPassed,
        step_completed: stepCompleted,
        can_access: orderIndex <= currentStep + 1,
    };
};

const queryActiveCourses = (env) =>
    env.DB.prepare(`
        SELECT id, name, description, categories_json, is_private, media_json, program_id, sys_order_index
        FROM lms_course WHERE is_active = 1 ORDER BY sys_order_index ASC, name ASC
    `).all();

// First IMAGE media url = the course cover (uploaded as media_json IMAGE). null when
// absent → the classroom card falls back to its deterministic gradient.
const extractCoverImageUrl = (mediaJson) => {
    if (!mediaJson) return null;
    try {
        const media = JSON.parse(mediaJson);
        return Array.isArray(media) ? (media.find((m) => m?.type === 'IMAGE')?.url ?? null) : null;
    } catch {
        return null;
    }
};

const queryCourseStepCount = (env, courseId) =>
    env.DB.prepare("SELECT COUNT(*) as count FROM lms_class WHERE course_id = ? AND node_kind = 'LESSON'").bind(courseId).first();

const queryCourseProgress = (env, userId, courseId) =>
    env.DB.prepare(`
        SELECT SUM(video_completed) as videos_completed, SUM(quiz_passed) as quizzes_passed
        FROM v_user_progress WHERE user_id = ? AND course_id = ?
    `).bind(userId, courseId).first();

const enrichCourseSummary = async (env, course, userId, lang) => {
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

export const listCoursesForUser = async (env, userId, lang) => {
    const courses = await queryActiveCourses(env);
    const enriched = await Promise.all(
        (courses.results || []).map((course) => enrichCourseSummary(env, course, userId, lang))
    );
    return { courses: enriched };
};

const queryCourseById = (env, courseId) =>
    env.DB.prepare('SELECT * FROM lms_course WHERE id = ? AND is_active = 1')
        .bind(courseId).first();

const queryCourseClasses = (env, userId, courseId) =>
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

const applyCourseTranslations = async (env, courseId, lang, baseTitle, baseDescription) => {
    if (!lang) return { title: baseTitle, description: baseDescription };
    const translations = await loadTranslations(env, 'course', courseId, lang);
    return {
        title: translations.name ?? baseTitle,
        description: translations.description ?? baseDescription,
    };
};

const applyClassTranslations = async (env, enrichedClasses, lang) => {
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

const buildAdjacency = (rows) => {
    const byParent = new Map();
    for (const row of rows) {
        const key = row.parent_class_id || ROOT_KEY;
        if (!byParent.has(key)) byParent.set(key, []);
        byParent.get(key).push(row);
    }
    for (const siblings of byParent.values()) {
        siblings.sort((a, b) => (a.sys_order_index ?? 0) - (b.sys_order_index ?? 0));
    }
    return byParent;
};

// Depth-first traversal → ordered flat list of LESSON leaf rows (the global step
// sequence used for sequential progress / can_access gating).
const flattenLessonsDFS = (byParent, key = ROOT_KEY, acc = []) => {
    for (const row of byParent.get(key) || []) {
        if ((row.node_kind || 'LESSON') === 'LESSON') acc.push(row);
        flattenLessonsDFS(byParent, row.id, acc);
    }
    return acc;
};

// Enrich the DFS-ordered lesson rows, assigning a GLOBAL step index by position
// (sys_order_index is now per-sibling, so array position is the true ordinal).
const enrichLessonSequence = (lessonRows) => {
    let currentStep = 0;
    const enriched = lessonRows.map((cls, i) => {
        const e = enrichClass(cls, currentStep);
        e.order_index = i;
        if (e.step_completed) currentStep = Math.max(currentStep, i);
        return e;
    });
    return enriched.map((e) => ({ ...e, can_access: e.order_index <= currentStep + 1 }));
};

// Build the display tree: SECTION folders + LESSON leaves (enriched/localized).
const buildDisplayTree = (byParent, lessonById, sectionNameById, key = ROOT_KEY) =>
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

const translateSectionNames = async (env, sectionRows, lang) => {
    const map = new Map();
    if (!lang) return map;
    await Promise.all(sectionRows.map(async (row) => {
        const t = await loadTranslations(env, 'class', row.id, lang);
        if (t.name) map.set(row.id, t.name);
    }));
    return map;
};

export const getCourseForUser = async (env, userId, courseId, lang) => {
    const course = await queryCourseById(env, courseId);
    if (!course) return { notFound: true };

    const classesResult = await queryCourseClasses(env, userId, courseId);
    const rows = classesResult.results || [];
    const byParent = buildAdjacency(rows);

    // Flat LESSON sequence (progress) + section folders (display).
    const lessonRows = flattenLessonsDFS(byParent);
    const enrichedLessons = enrichLessonSequence(lessonRows);
    const localizedLessons = await applyClassTranslations(env, enrichedLessons, lang);
    const lessonById = new Map(localizedLessons.map((l) => [l.id, l]));

    const sectionRows = rows.filter((r) => (r.node_kind || 'LESSON') === 'SECTION');
    const sectionNameById = await translateSectionNames(env, sectionRows, lang);

    const nodes = buildDisplayTree(byParent, lessonById, sectionNameById);
    const localizedCourse = await applyCourseTranslations(env, courseId, lang, course.name, course.description);

    const completedSteps = localizedLessons.filter(({ step_completed } = {}) => step_completed).length;
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
