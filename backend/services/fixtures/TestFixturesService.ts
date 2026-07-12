import type { Env } from "../../types/Env.js";

/**
 * TestFixturesService — seed canned learner-progress states for QA.
 *
 * Public API : applyFixture(env, userId, fixture, email?).
 * All DB access + iteration lives here ; the /api/test/seed handler stays
 * thin (parse + auth + delegate + jsonResponse).
 */

const CLASS_IDS = [
    'step01-valeurs-wge',
    'step02-vie-entreprise',
    'step03-process-operations',
    'step04-it-system',
    'step05-presentation-entreprise',
    'step06-marche-francais',
];

const STEP_COUNTS_BY_FIXTURE = {
    clean_slate: 0,
    step3: 2,
    last_step: 5,
    completed: 6,
};

export const VALID_FIXTURES = Object.keys(STEP_COUNTS_BY_FIXTURE);

const resolveContactId = async (db: D1Database, email: string | null): Promise<string | null> => {
    if (!email) return null;
    const result = await db.prepare(
        'SELECT id FROM crm_contact WHERE emails_json LIKE ?'
    ).bind(`%${email}%`).first<{ id: string }>();
    return result?.id || null;
};

const deleteForUser = (db: D1Database, userId: string) =>
    db.batch([
        db.prepare('DELETE FROM v_user_progress WHERE user_id = ?').bind(userId),
        db.prepare('DELETE FROM lms_event WHERE user_id = ?').bind(userId),
        db.prepare('DELETE FROM lms_signal WHERE user_id = ?').bind(userId),
        db.prepare('DELETE FROM gamification_award WHERE user_id = ?').bind(userId),
    ]);

const deleteForContactByEmail = async (db: D1Database, email: string) => {
    const contacts = await db.prepare(
        'SELECT id FROM crm_contact WHERE emails_json LIKE ?'
    ).bind(`%${email}%`).all();

    for (const contact of contacts.results || []) {
        const contactId = contact.id;
        await db.batch([
            db.prepare('DELETE FROM v_user_progress WHERE user_id = ?').bind(contactId),
            db.prepare('DELETE FROM lms_event WHERE user_id = ?').bind(contactId),
            db.prepare('DELETE FROM lms_signal WHERE user_id = ?').bind(contactId),
            db.prepare('DELETE FROM gamification_award WHERE user_id = ?').bind(contactId),
            db.prepare('DELETE FROM crm_event WHERE user_id = ?').bind(contactId),
        ]);
    }
};

const cleanSlate = async (db: D1Database, userId: string, email: string | null) => {
    await deleteForUser(db, userId);
    if (email) await deleteForContactByEmail(db, email);
};

const insertProgressRow = (db: D1Database, userId: string, courseId: string, classId: string, timestamp: string) =>
    db.prepare(`
        INSERT INTO v_user_progress
        (user_id, class_id, course_id, video_max_position_sec, video_duration_sec,
         video_completed, video_completed_at, quiz_passed, quiz_score, quiz_max_score,
         quiz_passed_at, updated_at)
        VALUES (?, ?, ?, 300, 300, 1, ?, 1, 1, 1, ?, ?)
    `).bind(userId, classId, courseId, timestamp, timestamp, timestamp).run();

const insertEvent = (db: D1Database, eventId: string, type: string, userId: string, courseId: string, classId: string, timestamp: string, payload: unknown) =>
    db.prepare(`
        INSERT INTO lms_event (id, type, user_id, course_id, class_id, occurred_at, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(eventId, type, userId, courseId, classId, timestamp, JSON.stringify(payload)).run();

const awardBadge = (db: D1Database, awardId: string, badgeId: string, userId: string, now: string) =>
    db.prepare(`
        INSERT OR IGNORE INTO gamification_award (id, badge_id, user_id, user_type, awarded_at, created_at)
        VALUES (?, ?, ?, 'contact', ?, ?)
    `).bind(awardId, badgeId, userId, now, now).run();

const completeOneStep = async (db: D1Database, userId: string, courseId: string, classId: string, stepIndex: number, hourOffset: number) => {
    const timestamp = new Date(Date.now() - hourOffset * 3600000).toISOString();
    await insertProgressRow(db, userId, courseId, classId, timestamp);

    await insertEvent(
        db,
        `evt_fixture_${Date.now()}_${stepIndex}_v`,
        'VIDEO_PING',
        userId,
        courseId,
        classId,
        timestamp,
        { video_id: `${classId}-video`, position_sec: 300, duration_sec: 300 },
    );

    await insertEvent(
        db,
        `evt_fixture_${Date.now()}_${stepIndex}_q`,
        'QUIZ_SUBMIT',
        userId,
        courseId,
        classId,
        timestamp,
        { quiz_id: `${classId}-quiz`, score: 1, max_score: 1 },
    );
};

const completeSteps = async (db: D1Database, userId: string, count: number) => {
    const courseId = 'pw05-2';
    const now = new Date().toISOString();
    const stepCount = Math.min(count, CLASS_IDS.length);
    for (let i = 0; i < stepCount; i += 1) {
        await completeOneStep(db, userId, courseId, CLASS_IDS[i], i, count - i);
    }
    if (count >= 1) await awardBadge(db, `fixture_award_first_quiz_${userId}`, 'first_quiz', userId, now);
    if (count >= 2) await awardBadge(db, `fixture_award_perfect_${userId}`, 'perfect_quiz', userId, now);
    if (count >= 5) await awardBadge(db, `fixture_award_video5_${userId}`, 'video_5', userId, now);
    if (count >= 6) await awardBadge(db, `fixture_award_course_${userId}`, 'course_complete', userId, now);
};

export const applyFixture = async (env: Env, cfUserId: string, fixture: string, email: string | null = null) => {
    if (!(fixture in STEP_COUNTS_BY_FIXTURE)) {
        throw new Error(`Unknown fixture: ${fixture}`);
    }

    const db = env.DB;
    const contactId = await resolveContactId(db, email);

    if (!contactId && fixture !== 'clean_slate') {
        throw new Error(`Cannot resolve contact_id for email: ${email}. User must exist in crm_contact.`);
    }

    await cleanSlate(db, cfUserId, email);

    const insertUserId = contactId || cfUserId;
    const stepCount = STEP_COUNTS_BY_FIXTURE[fixture as keyof typeof STEP_COUNTS_BY_FIXTURE];
    if (stepCount > 0) await completeSteps(db, insertUserId, stepCount);
};
