/**
 * SignalsService — course/step signal aggregation + progress reset.
 */

import { checkCourseCompletionBadges, recordCourseCompletion } from '../../utils/xp/index.js';
import { resolveProgressionMode } from '../courses/_progressionMode.js';
import type { Env } from "../../types/Env.js";

const queryCourseSteps = (env: Env, userId: string, courseId: string) =>
    env.DB.prepare(`
        SELECT c.id as class_id, c.name, c.sys_order_index, c.media_json,
            COALESCE(p.video_completed, 0) as video_completed,
            COALESCE(p.quiz_passed, 0) as quiz_passed,
            p.video_max_position_sec, p.video_duration_sec
        FROM lms_class c
        LEFT JOIN v_user_progress p ON p.class_id = c.id AND p.user_id = ?
        WHERE c.course_id = ? AND c.node_kind = 'LESSON' ORDER BY c.sys_order_index
    `).bind(userId, courseId).all();

const queryCourseRaw = (env: Env, courseId: string) =>
    env.DB.prepare('SELECT raw_json FROM lms_course WHERE id = ?').bind(courseId).first();

const queryClassMeta = (env: Env, classId: string, courseId: string) =>
    env.DB.prepare('SELECT id, name, sys_order_index, media_json FROM lms_class WHERE id = ? AND course_id = ?')
        .bind(classId, courseId).first();

const queryStepProgress = (env: Env, userId: string, classId: string) =>
    env.DB.prepare('SELECT * FROM v_user_progress WHERE user_id = ? AND class_id = ?')
        .bind(userId, classId).first();

const parseStep = (row, currentStep) => {
    const media = JSON.parse(row.media_json || '[]');
    const hasQuiz = media.some(({ type } = {}) => type === 'QUIZ');
    const hasVideo = media.some(({ type } = {}) => type === 'VIDEO');
    const videoCompleted = row.video_completed === 1;
    const quizPassed = row.quiz_passed === 1;
    const stepCompleted = hasQuiz ? quizPassed : (hasVideo ? videoCompleted : false);
    return {
        class_id: row.class_id,
        name: row.name,
        order_index: row.sys_order_index,
        has_quiz: hasQuiz,
        video_completed: videoCompleted,
        quiz_passed: quizPassed,
        step_completed: stepCompleted,
        can_access: row.sys_order_index <= currentStep + 1,
    };
};

const hasCorruptedState = (steps) =>
    steps.some((s, i) => {
        if (!s.quiz_passed) return false;
        const nextStep = steps[i + 1];
        return nextStep && !nextStep.can_access;
    });

export const resetProgress = async (env: Env, userId: string, courseId: string) => {
    const db = env.DB;
    await db.prepare('DELETE FROM v_user_progress WHERE user_id = ? AND course_id = ?')
        .bind(userId, courseId).run();
    await db.prepare('DELETE FROM lms_event WHERE user_id = ? AND course_id = ?')
        .bind(userId, courseId).run();
};

const collectVideoPosition = (row) => {
    if (!row.video_max_position_sec || row.video_max_position_sec <= 0) return null;
    const duration = row.video_duration_sec || 1;
    return {
        position: row.video_max_position_sec,
        duration,
        percentage: Math.round((row.video_max_position_sec / duration) * 100),
    };
};

export const fetchCourseSignals = async (env: Env, userId: string, courseId: string) => {
    const [result, courseRow] = await Promise.all([
        queryCourseSteps(env, userId, courseId),
        queryCourseRaw(env, courseId),
    ]);
    const progressionMode = resolveProgressionMode(courseRow?.raw_json);
    const isFree = progressionMode === 'free';

    let currentStep = 0;
    const videoPositions = {};
    const steps = (result.results || []).map((row) => {
        const step = parseStep(row, currentStep);
        if (step.step_completed) currentStep = Math.max(currentStep, row.sys_order_index);
        const videoPosition = collectVideoPosition(row);
        if (videoPosition) videoPositions[row.class_id] = videoPosition;
        return step;
    });

    for (const step of steps) {
        // Free mode: every lesson reachable. Linear: unlock up to the next step.
        step.can_access = isFree ? true : step.order_index <= currentStep + 1;
    }

    // The corrupted-state auto-reset only guards the linear unlock invariant.
    if (!isFree && hasCorruptedState(steps)) {
        await resetProgress(env, userId, courseId);
        return { corrupted: true };
    }

    const completedSteps = steps.filter(({ step_completed } = {}) => step_completed).length;
    const totalSteps = steps.length;
    const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
    const courseCompleted = steps.every(({ step_completed } = {}) => step_completed) && steps.length > 0;

    let badgesEarned = [];
    if (courseCompleted) {
        const isNew = await recordCourseCompletion(env.DB, userId, courseId);
        if (isNew) badgesEarned = await checkCourseCompletionBadges(env.DB, userId, courseId);
    }

    return {
        corrupted: false,
        body: {
            course_id: courseId,
            progression_mode: progressionMode,
            steps,
            current_step: currentStep,
            can_access_step: isFree ? steps.length : Math.min(currentStep + 1, steps.length),
            total_steps: steps.length,
            course_completed: courseCompleted,
            course_progress: { completed: completedSteps, total: totalSteps, percent: progressPercent },
            video_positions: videoPositions,
            badges_earned: badgesEarned,
        },
    };
};

export const fetchStepSignals = async (env: Env, userId: string, courseId: string, classId: string) => {
    const [cls, progress] = await Promise.all([
        queryClassMeta(env, classId, courseId),
        queryStepProgress(env, userId, classId),
    ]);
    if (!cls) return { notFound: true };

    const media = JSON.parse(cls.media_json || '[]');
    const hasQuiz = media.some(({ type } = {}) => type === 'QUIZ');
    const hasVideo = media.some(({ type } = {}) => type === 'VIDEO');
    const videoCompleted = progress?.video_completed === 1;
    const quizPassed = progress?.quiz_passed === 1;

    return {
        notFound: false,
        body: {
            class_id: classId,
            class_name: cls.name,
            order_index: cls.sys_order_index,
            has_quiz: hasQuiz,
            video_completed: videoCompleted,
            quiz_passed: quizPassed,
            step_completed: hasQuiz ? quizPassed : (hasVideo ? videoCompleted : false),
            progress: {
                video_max_position_sec: progress?.video_max_position_sec || 0,
                video_duration_sec: progress?.video_duration_sec || 0,
                video_coverage_pct: progress?.video_duration_sec
                    ? Math.round((progress.video_max_position_sec / progress.video_duration_sec) * 100)
                    : 0,
            },
        },
    };
};
