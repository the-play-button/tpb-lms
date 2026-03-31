// entropy-single-export-ok: 2 tightly-coupled course handlers (list, get) sharing translation and enrichment helpers
// entropy-handler-service-pattern-ok: simple handler, business logic is minimal
/**
 * Courses Handler
 *
 * Uses lms_course and lms_class (Unified.to aligned).
 * Supports multi-language via ?lang= parameter.
 * Refactored for reduced complexity.
 */

import { jsonResponse } from '../cors.js';

const loadTranslations = async (env, contentType, contentId, lang) => {
    const result = await env.DB.prepare(`
        SELECT field, value FROM translations 
        WHERE content_type = ? AND content_id = ? AND lang = ?
    `).bind(contentType, contentId, lang).all();
    
    const map = {};
    for (const row of result.results || []) {
        map[row.field] = row.value;
    }
    return map;
};

const applyTranslations = (obj, translations) => {
    if (!translations || Object.keys(translations).length === 0) {
        return obj;
    }
    
    const result = { ...obj };
    for (const [field, value] of Object.entries(translations)) {
        if (field === 'name' && result.title !== undefined) {
            result.title = value;
        }
        if (result[field] !== undefined) {
            result[field] = value;
        }
    }
    return result;
};

const enrichMedia = (media, videoCompleted, quizPassed, cls) => {
    if (media.type === 'VIDEO') {
        const coveragePct = cls.video_duration_sec 
            ? Math.round((cls.video_max_position_sec / cls.video_duration_sec) * 100) : 0;
        return { ...media, completed: videoCompleted, coverage_pct: coveragePct };
    }
    if (media.type === 'QUIZ') {
        return { ...media, passed: quizPassed };
    }
    return media;
};

const enrichClass = (cls, currentStep) => {
    const media = cls.media_json ? JSON.parse(cls.media_json) : [];
    const raw = cls.raw_json ? JSON.parse(cls.raw_json) : {};
    const hasQuiz = media.some(({ type }) => type === 'QUIZ');
    
    const videoCompleted = cls.video_completed === 1;
    const quizPassed = cls.quiz_passed === 1;
    const stepCompleted = videoCompleted && (!hasQuiz || quizPassed);
    
    const orderIndex = cls.sys_order_index ?? 0;
    
    return {
        id: cls.id,
        name: cls.name,
        description: cls.description,
        order_index: orderIndex, // Keep same API field name for backward compat
        media: media.map(m => enrichMedia(m, videoCompleted, quizPassed, cls)),
        step_type: raw.tpb_step_type || 'CONTENT',
        content_md: raw.tpb_content_md || '',
        video_completed: videoCompleted,
        quiz_passed: quizPassed,
        step_completed: stepCompleted,
        can_access: orderIndex <= currentStep + 1
    };
};

const processClasses = classes => {
    let currentStep = 0;
    const enrichedClasses = classes.map(cls => {
        const orderIndex = cls.sys_order_index ?? 0;
        const enriched = enrichClass(cls, currentStep);
        if (enriched.step_completed) {
            currentStep = Math.max(currentStep, orderIndex);
            enriched.can_access = orderIndex <= currentStep + 1;
        }
        return enriched;
    });
    
    return enrichedClasses.map(cls => ({
        ...cls,
        can_access: cls.order_index <= currentStep + 1
    }));
};

// ============================================
// ============================================

/**
 * GET /api/courses
 * Supports ?lang= parameter for translations
 */
export const listCourses = async (request, env, userContext) => {
    const userId = userContext.contact?.id || userContext.employee?.id;
    const url = new URL(request.url);
    const lang = url.searchParams.get('lang');
    
    const courses = await env.DB.prepare(`
        SELECT id, name, description, categories_json, is_private
        FROM lms_course WHERE is_active = 1 ORDER BY name ASC
    `).all();
    
    const enrichedCourses = await Promise.all(
        (courses.results || []).map(async course => {
            const [stepCount, progress] = await Promise.all([
                env.DB.prepare(`SELECT COUNT(*) as count FROM lms_class WHERE course_id = ?`).bind(course.id).first(),
                env.DB.prepare(`
                    SELECT SUM(video_completed) as videos_completed, SUM(quiz_passed) as quizzes_passed
                    FROM v_user_progress WHERE user_id = ? AND course_id = ?
                `).bind(userId, course.id).first()
            ]);
            
            let result = {
                id: course.id,
                title: course.name,
                description: course.description,
                categories: course.categories_json ? JSON.parse(course.categories_json) : [],
                is_private: course.is_private === 1,
                total_steps: stepCount?.count || 0,
                progress: { videos_completed: progress?.videos_completed || 0, quizzes_passed: progress?.quizzes_passed || 0 }
            };
            
            if (lang) {
                const translations = await loadTranslations(env, 'course', course.id, lang);
                result = applyTranslations(result, translations);
            }
            
            return result;
        })
    );
    
    return jsonResponse({ courses: enrichedCourses }, 200, request);
};

/**
 * GET /api/courses/:id
 * Supports ?lang= parameter for translations
 */
export const getCourse = async (request, env, userContext, courseId) => {
    const userId = userContext.contact?.id || userContext.employee?.id;
    const url = new URL(request.url);
    const lang = url.searchParams.get('lang');
    
    const course = await env.DB.prepare(`
        SELECT * FROM lms_course WHERE id = ? AND is_active = 1
    `).bind(courseId).first();
    
    if (!course) {
        return jsonResponse({ error: 'Course not found' }, 404, request);
    }
    
    const classes = await env.DB.prepare(`
        SELECT c.id, c.name, c.description, c.media_json, 
            c.sys_order_index, c.raw_json,
            COALESCE(p.video_completed, 0) as video_completed,
            COALESCE(p.quiz_passed, 0) as quiz_passed,
            p.video_max_position_sec, p.video_duration_sec
        FROM lms_class c
        LEFT JOIN v_user_progress p ON p.class_id = c.id AND p.user_id = ?
        WHERE c.course_id = ? ORDER BY c.sys_order_index ASC
    `).bind(userId, courseId).all();
    
    let enrichedClasses = processClasses(classes.results || []);
    
    let courseTitle = course.name;
    let courseDescription = course.description;
    
    if (lang) {
        const courseTranslations = await loadTranslations(env, 'course', courseId, lang);
        if (courseTranslations.name) courseTitle = courseTranslations.name;
        if (courseTranslations.description) courseDescription = courseTranslations.description;
        
        enrichedClasses = await Promise.all(enrichedClasses.map(async (cls) => {
            const classTranslations = await loadTranslations(env, 'class', cls.id, lang);
            return applyTranslations(cls, classTranslations);
        }));
    }
    
    const completedSteps = enrichedClasses.filter(({ step_completed } = {}) => step_completed).length;
    const currentStep = enrichedClasses.filter(({ step_completed } = {}) => step_completed).length; // entropy-naming-convention-ok: scalar count value

    return jsonResponse({
        id: course.id,
        title: courseTitle,
        description: courseDescription,
        categories: course.categories_json ? JSON.parse(course.categories_json) : [],
        classes: enrichedClasses,
        progress: {
            total_steps: enrichedClasses.length,
            completed_steps: completedSteps,
            current_step: currentStep,
            can_access_step: Math.min(currentStep + 1, enrichedClasses.length)
        }
    }, 200, request);
};
