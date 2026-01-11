/**
 * Signals Handler
 * 
 * Read-only API for getting user progress.
 * Reads directly from v_user_progress (materialized view).
 * Refactored for reduced complexity.
 */

import { jsonResponse } from '../cors.js';
import { checkCourseCompletionBadges, recordCourseCompletion } from '../helpers/xp.js';

// ============================================
// Helper functions
// ============================================

/**
 * Parse step data from raw DB row
 */
function parseStep(row, currentStep) {
    const media = JSON.parse(row.media_json || '[]');
    const hasQuiz = media.some(m => m.type === 'QUIZ');
    const hasVideo = media.some(m => m.type === 'VIDEO');
    const videoCompleted = row.video_completed === 1;
    const quizPassed = row.quiz_passed === 1;
    // Quiz → quiz passed | Video → video completed | Content → allow advance (frontend handles)
    const stepCompleted = hasQuiz ? quizPassed : (hasVideo ? videoCompleted : false);
    
    return {
        class_id: row.class_id,
        name: row.name,
        order_index: row.sys_order_index,  // Keep API field name for backward compat
        has_quiz: hasQuiz,
        video_completed: videoCompleted,
        quiz_passed: quizPassed,
        step_completed: stepCompleted,
        can_access: row.sys_order_index <= currentStep + 1
    };
}

/**
 * Check for corrupted state (quiz passed but next step locked)
 */
function hasCorruptedState(steps) {
    return steps.some((s, i) => {
        if (!s.quiz_passed) return false;
        const nextStep = steps[i + 1];
        return nextStep && !nextStep.can_access;
    });
}

/**
 * Reset progress for a user/course
 */
async function resetProgress(db, userId, courseId) {
    await db.prepare('DELETE FROM v_user_progress WHERE user_id = ? AND course_id = ?')
        .bind(userId, courseId).run();
    await db.prepare('DELETE FROM lms_event WHERE user_id = ? AND course_id = ?')
        .bind(userId, courseId).run();
}

// ============================================
// Main handlers
// ============================================

/**
 * GET /api/signals/:courseId
 */
export async function getCourseSignalsHandler(request, env, userContext, courseId) {
    const userId = userContext.contact?.id || userContext.employee?.id;
    if (!userId) return jsonResponse({ error: 'User not authenticated' }, 401, request);
    
    const result = await env.DB.prepare(`
        SELECT c.id as class_id, c.name, c.sys_order_index, c.media_json,
            COALESCE(p.video_completed, 0) as video_completed,
            COALESCE(p.quiz_passed, 0) as quiz_passed,
            p.video_max_position_sec, p.video_duration_sec
        FROM lms_class c
        LEFT JOIN v_user_progress p ON p.class_id = c.id AND p.user_id = ?
        WHERE c.course_id = ? ORDER BY c.sys_order_index
    `).bind(userId, courseId).all();
    
    // First pass: parse steps and track currentStep + video positions
    let currentStep = 0;
    const videoPositions = {}; // GAP-102: Map class_id -> position data
    
    const steps = (result.results || []).map(row => {
        const step = parseStep(row, currentStep);
        if (step.step_completed) currentStep = Math.max(currentStep, row.sys_order_index);
        
        // GAP-102: Track video positions for resume
        if (row.video_max_position_sec > 0) {
            const duration = row.video_duration_sec || 1;
            videoPositions[row.class_id] = {
                position: row.video_max_position_sec,
                duration: duration,
                percentage: Math.round((row.video_max_position_sec / duration) * 100)
            };
        }
        
        return step;
    });
    
    // Second pass: update can_access with final currentStep
    steps.forEach(step => { step.can_access = step.order_index <= currentStep + 1; });
    
    // Check for corrupted state
    if (hasCorruptedState(steps)) {
        await resetProgress(env.DB, userId, courseId);
        return jsonResponse({
            error: 'PROGRESS_RESET',
            message: 'État incohérent détecté. Progression réinitialisée.',
            reload: true
        }, 409, request);
    }
    
    // Calculate course progress (GAP-601)
    const completedSteps = steps.filter(s => s.step_completed).length;
    const totalSteps = steps.length;
    const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
    const courseCompleted = steps.every(s => s.step_completed) && steps.length > 0;
    
    // Award badges when course is completed for the first time
    let badgesEarned = [];
    if (courseCompleted) {
        const isNew = await recordCourseCompletion(env.DB, userId, courseId);
        if (isNew) {
            badgesEarned = await checkCourseCompletionBadges(env.DB, userId, courseId);
        }
    }
    
    return jsonResponse({
        course_id: courseId,
        steps,
        current_step: currentStep,
        can_access_step: Math.min(currentStep + 1, steps.length),
        total_steps: steps.length,
        course_completed: courseCompleted,
        // GAP-601: Course progress
        course_progress: {
            completed: completedSteps,
            total: totalSteps,
            percent: progressPercent
        },
        // GAP-102: Video positions for resume
        video_positions: videoPositions,
        // Badges earned on completion
        badges_earned: badgesEarned
    }, 200, request);
}

/**
 * GET /api/signals/:courseId/:classId
 */
export async function getStepSignals(request, env, userContext, courseId, classId) {
    const userId = userContext.contact?.id || userContext.employee?.id;
    if (!userId) return jsonResponse({ error: 'User not authenticated' }, 401, request);
    
    const [cls, progress] = await Promise.all([
        env.DB.prepare(`SELECT id, name, sys_order_index, media_json FROM lms_class WHERE id = ? AND course_id = ?`)
            .bind(classId, courseId).first(),
        env.DB.prepare(`SELECT * FROM v_user_progress WHERE user_id = ? AND class_id = ?`)
            .bind(userId, classId).first()
    ]);
    
    if (!cls) return jsonResponse({ error: 'Class not found' }, 404, request);
    
    const media = JSON.parse(cls.media_json || '[]');
    const hasQuiz = media.some(m => m.type === 'QUIZ');
    const hasVideo = media.some(m => m.type === 'VIDEO');
    const videoCompleted = progress?.video_completed === 1;
    const quizPassed = progress?.quiz_passed === 1;
    const stepCompleted = hasQuiz ? quizPassed : (hasVideo ? videoCompleted : false);
    
    return jsonResponse({
        class_id: classId,
        class_name: cls.name,
        order_index: cls.sys_order_index,  // Keep API field name for backward compat
        has_quiz: hasQuiz,
        video_completed: videoCompleted,
        quiz_passed: quizPassed,
        step_completed: stepCompleted,
        progress: {
            video_max_position_sec: progress?.video_max_position_sec || 0,
            video_duration_sec: progress?.video_duration_sec || 0,
            video_coverage_pct: progress?.video_duration_sec 
                ? Math.round((progress.video_max_position_sec / progress.video_duration_sec) * 100) : 0
        }
    }, 200, request);
}

/**
 * POST /api/signals/:courseId/reset
 */
export async function resetCourseSignals(request, env, userContext, courseId) {
    const userId = userContext.contact?.id || userContext.employee?.id;
    if (!userId) return jsonResponse({ error: 'User not authenticated' }, 401, request);
    
    await resetProgress(env.DB, userId, courseId);
    
    return jsonResponse({ success: true, message: 'Progress reset' }, 200, request);
}
