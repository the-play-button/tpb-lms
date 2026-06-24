/**
 * CoursesService — list/get course aggregation with translations + progress.
 */

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

const processClasses = (classes) => {
    let currentStep = 0;
    const enrichedClasses = classes.map((cls) => {
        const enriched = enrichClass(cls, currentStep);
        if (enriched.step_completed) currentStep = Math.max(currentStep, enriched.order_index);
        return enriched;
    });
    return enrichedClasses.map((cls) => ({ ...cls, can_access: cls.order_index <= currentStep + 1 }));
};

const queryActiveCourses = (env) =>
    env.DB.prepare(`
        SELECT id, name, description, categories_json, is_private
        FROM lms_course WHERE is_active = 1 ORDER BY name ASC
    `).all();

const queryCourseStepCount = (env, courseId) =>
    env.DB.prepare('SELECT COUNT(*) as count FROM lms_class WHERE course_id = ?').bind(courseId).first();

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

export const getCourseForUser = async (env, userId, courseId, lang) => {
    const course = await queryCourseById(env, courseId);
    if (!course) return { notFound: true };

    const classesResult = await queryCourseClasses(env, userId, courseId);
    const enrichedClasses = processClasses(classesResult.results || []);
    const localizedClasses = await applyClassTranslations(env, enrichedClasses, lang);
    const localizedCourse = await applyCourseTranslations(env, courseId, lang, course.name, course.description);

    const completedSteps = localizedClasses.filter(({ step_completed } = {}) => step_completed).length;
    const currentStepIndex = completedSteps;

    return {
        notFound: false,
        body: {
            id: course.id,
            title: localizedCourse.title,
            description: localizedCourse.description,
            categories: course.categories_json ? JSON.parse(course.categories_json) : [],
            classes: localizedClasses,
            progress: {
                total_steps: localizedClasses.length,
                completed_steps: completedSteps,
                current_step: currentStepIndex,
                can_access_step: Math.min(currentStepIndex + 1, localizedClasses.length),
            },
        },
    };
};
