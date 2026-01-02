/**
 * Courses Handler
 * 
 * Uses lms_course and lms_class (Unified.to aligned).
 * Refactored for reduced complexity.
 */

import { jsonResponse } from '../cors.js';

// ============================================
// Helper functions
// ============================================

/**
 * Enrich a single media item with progress
 */
function enrichMedia(media, videoCompleted, quizPassed, cls) {
    if (media.type === 'VIDEO') {
        const coveragePct = cls.video_duration_sec 
            ? Math.round((cls.video_max_position_sec / cls.video_duration_sec) * 100) : 0;
        return { ...media, completed: videoCompleted, coverage_pct: coveragePct };
    }
    if (media.type === 'QUIZ') {
        return { ...media, passed: quizPassed };
    }
    return media;
}

/**
 * Enrich a single class with progress data
 */
function enrichClass(cls, currentStep) {
    const media = cls.media_json ? JSON.parse(cls.media_json) : [];
    const raw = cls.raw_json ? JSON.parse(cls.raw_json) : {};
    const hasQuiz = media.some(m => m.type === 'QUIZ');
    
    const videoCompleted = cls.video_completed === 1;
    const quizPassed = cls.quiz_passed === 1;
    const stepCompleted = videoCompleted && (!hasQuiz || quizPassed);
    
    return {
        id: cls.id,
        name: cls.name,
        description: cls.description,
        order_index: cls.order_index,
        media: media.map(m => enrichMedia(m, videoCompleted, quizPassed, cls)),
        step_type: raw.tpb_step_type || 'CONTENT',
        content_md: raw.tpb_content_md || '',
        video_completed: videoCompleted,
        quiz_passed: quizPassed,
        step_completed: stepCompleted,
        can_access: cls.order_index <= currentStep + 1
    };
}

/**
 * Process classes and determine current step
 */
function processClasses(classes) {
    let currentStep = 0;
    const enrichedClasses = classes.map(cls => {
        const enriched = enrichClass(cls, currentStep);
        if (enriched.step_completed) {
            currentStep = Math.max(currentStep, cls.order_index);
            enriched.can_access = cls.order_index <= currentStep + 1;
        }
        return enriched;
    });
    
    // Second pass to fix can_access now that currentStep is known
    return enrichedClasses.map(cls => ({
        ...cls,
        can_access: cls.order_index <= currentStep + 1
    }));
}

// ============================================
// Main handlers
// ============================================

/**
 * GET /api/courses
 */
export async function listCourses(request, env, userContext) {
    const userId = userContext.contact?.id || userContext.employee?.id;
    
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
            
            return {
                id: course.id,
                title: course.name,
                description: course.description,
                categories: course.categories_json ? JSON.parse(course.categories_json) : [],
                is_private: course.is_private === 1,
                total_steps: stepCount?.count || 0,
                progress: { videos_completed: progress?.videos_completed || 0, quizzes_passed: progress?.quizzes_passed || 0 }
            };
        })
    );
    
    return jsonResponse({ courses: enrichedCourses }, 200, request);
}

/**
 * GET /api/courses/:id
 */
export async function getCourse(request, env, userContext, courseId) {
    const userId = userContext.contact?.id || userContext.employee?.id;
    
    const course = await env.DB.prepare(`
        SELECT * FROM lms_course WHERE id = ? AND is_active = 1
    `).bind(courseId).first();
    
    if (!course) {
        return jsonResponse({ error: 'Course not found' }, 404, request);
    }
    
    const classes = await env.DB.prepare(`
        SELECT c.id, c.name, c.description, c.media_json, c.order_index, c.raw_json,
            COALESCE(p.video_completed, 0) as video_completed,
            COALESCE(p.quiz_passed, 0) as quiz_passed,
            p.video_max_position_sec, p.video_duration_sec
        FROM lms_class c
        LEFT JOIN v_user_progress p ON p.class_id = c.id AND p.user_id = ?
        WHERE c.course_id = ? ORDER BY c.order_index ASC
    `).bind(userId, courseId).all();
    
    const enrichedClasses = processClasses(classes.results || []);
    const completedSteps = enrichedClasses.filter(c => c.step_completed).length;
    const currentStep = enrichedClasses.filter(c => c.step_completed).length;

    return jsonResponse({
        id: course.id,
        title: course.name,
        description: course.description,
        categories: course.categories_json ? JSON.parse(course.categories_json) : [],
        classes: enrichedClasses,
        progress: {
            total_steps: enrichedClasses.length,
            completed_steps: completedSteps,
            current_step: currentStep,
            can_access_step: Math.min(currentStep + 1, enrichedClasses.length)
        }
    }, 200, request);
}
