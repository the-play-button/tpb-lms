// entropy-positional-args-excess-ok: handler exports (recordQuizEvent) use CF Worker positional convention (request, env, ctx)
/**
 * Record a quiz event in crm_event
 */

export const recordQuizEvent = async (db, userId, quizId, courseId, classId, score, maxScore, passed, answers) => {
    const now = new Date().toISOString();
    const id = `evt_${crypto.randomUUID()}`;

    await db.prepare(`
        INSERT INTO crm_event (id, type, user_id, form_json, created_at, updated_at)
        VALUES (?, 'FORM', ?, ?, ?, ?)
    `).bind(
        id,
        userId,
        JSON.stringify({
            quiz_id: quizId,
            course_id: courseId,
            class_id: classId,
            name: `Quiz ${quizId}`,
            score,
            max_score: maxScore,
            passed: passed ? 1 : 0,
            fields: answers || []
        }),
        now,
        now
    ).run();

    return id;
};
