/**
 * Test Fixtures Handler
 * 
 * Provides an endpoint for seeding test data.
 * Protected by a secret header (TEST_SECRET).
 */

import { jsonResponse } from '../cors.js';

// Class IDs for pw05-2 course
const CLASS_IDS = [
    'step01-valeurs-wge',
    'step02-vie-entreprise', 
    'step03-process-operations',
    'step04-it-system',
    'step05-presentation-entreprise',
    'step06-marche-francais'
];

/**
 * Resolve contact_id from email
 */
async function resolveContactId(db, email) {
    if (!email) return null;
    const result = await db.prepare(
        "SELECT id FROM crm_contact WHERE emails_json LIKE ?"
    ).bind(`%${email}%`).first();
    return result?.id || null;
}

/**
 * Apply a fixture for a user
 * @param {D1Database} db
 * @param {string} cfUserId - CF Access user_id (sub) - used for cleanup only
 * @param {string} fixture - Fixture name
 * @param {string} email - User email (REQUIRED to resolve contact_id)
 */
async function applyFixture(db, cfUserId, fixture, email = null) {
    // Resolve the contact_id (this is what the API actually uses)
    const contactId = await resolveContactId(db, email);
    
    if (!contactId && fixture !== 'clean_slate') {
        throw new Error(`Cannot resolve contact_id for email: ${email}. User must exist in crm_contact.`);
    }
    
    // Always clean first (by both cfUserId and contactId)
    await cleanSlate(db, cfUserId, email);
    
    // Use contactId for inserts (what the API actually queries)
    const insertUserId = contactId || cfUserId;
    
    switch (fixture) {
        case 'clean_slate':
            // Already done
            break;
            
        case 'step3':
            await completeSteps(db, insertUserId, 2);
            break;
            
        case 'last_step':
            await completeSteps(db, insertUserId, 5);
            break;
            
        case 'completed':
            await completeSteps(db, insertUserId, 6);
            break;
            
        default:
            throw new Error(`Unknown fixture: ${fixture}`);
    }
}

/**
 * Clean all progress for a user
 * Cleans by both CF Access user_id AND contact_id (resolved from email)
 */
async function cleanSlate(db, userId, email = null) {
    // Clean by CF Access user_id
    await db.batch([
        db.prepare('DELETE FROM v_user_progress WHERE user_id = ?').bind(userId),
        db.prepare('DELETE FROM lms_event WHERE user_id = ?').bind(userId),
        db.prepare('DELETE FROM lms_signal WHERE user_id = ?').bind(userId),
        db.prepare('DELETE FROM gamification_award WHERE user_id = ?').bind(userId),
    ]);
    
    // If email provided, also clean by contact_id
    if (email) {
        // Find contact_id(s) for this email
        const contacts = await db.prepare(
            "SELECT id FROM crm_contact WHERE emails_json LIKE ?"
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
    }
}

/**
 * Complete N steps for a user
 */
async function completeSteps(db, userId, count) {
    const courseId = 'pw05-2';
    const now = new Date().toISOString();
    
    for (let i = 0; i < Math.min(count, CLASS_IDS.length); i++) {
        const classId = CLASS_IDS[i];
        const hourOffset = count - i; // Older steps are further back in time
        const timestamp = new Date(Date.now() - hourOffset * 3600000).toISOString();
        
        // Insert progress
        await db.prepare(`
            INSERT INTO v_user_progress 
            (user_id, class_id, course_id, video_max_position_sec, video_duration_sec, 
             video_completed, video_completed_at, quiz_passed, quiz_score, quiz_max_score, 
             quiz_passed_at, updated_at)
            VALUES (?, ?, ?, 300, 300, 1, ?, 1, 1, 1, ?, ?)
        `).bind(userId, classId, courseId, timestamp, timestamp, timestamp).run();
        
        // Insert events
        const eventId1 = `evt_fixture_${Date.now()}_${i}_v`;
        const eventId2 = `evt_fixture_${Date.now()}_${i}_q`;
        
        await db.prepare(`
            INSERT INTO lms_event (id, type, user_id, course_id, class_id, occurred_at, payload_json)
            VALUES (?, 'VIDEO_PING', ?, ?, ?, ?, ?)
        `).bind(eventId1, userId, courseId, classId, timestamp, 
            JSON.stringify({ video_id: `${classId}-video`, position_sec: 300, duration_sec: 300 })
        ).run();
        
        await db.prepare(`
            INSERT INTO lms_event (id, type, user_id, course_id, class_id, occurred_at, payload_json)
            VALUES (?, 'QUIZ_SUBMIT', ?, ?, ?, ?, ?)
        `).bind(eventId2, userId, courseId, classId, timestamp,
            JSON.stringify({ quiz_id: `${classId}-quiz`, score: 1, max_score: 1 })
        ).run();
    }
    
    // Add badges
    if (count >= 1) {
        await db.prepare(`
            INSERT OR IGNORE INTO gamification_award (id, badge_id, user_id, user_type, awarded_at, created_at)
            VALUES (?, 'first_quiz', ?, 'contact', ?, ?)
        `).bind(`fixture_award_first_quiz_${userId}`, userId, now, now).run();
    }
    
    if (count >= 2) {
        await db.prepare(`
            INSERT OR IGNORE INTO gamification_award (id, badge_id, user_id, user_type, awarded_at, created_at)
            VALUES (?, 'perfect_quiz', ?, 'contact', ?, ?)
        `).bind(`fixture_award_perfect_${userId}`, userId, now, now).run();
    }
    
    if (count >= 5) {
        await db.prepare(`
            INSERT OR IGNORE INTO gamification_award (id, badge_id, user_id, user_type, awarded_at, created_at)
            VALUES (?, 'video_5', ?, 'contact', ?, ?)
        `).bind(`fixture_award_video5_${userId}`, userId, now, now).run();
    }
    
    if (count >= 6) {
        await db.prepare(`
            INSERT OR IGNORE INTO gamification_award (id, badge_id, user_id, user_type, awarded_at, created_at)
            VALUES (?, 'course_complete', ?, 'contact', ?, ?)
        `).bind(`fixture_award_course_${userId}`, userId, now, now).run();
    }
}

/**
 * POST /api/test/seed
 * 
 * Headers:
 *   X-Test-Secret: <env.TEST_SECRET>
 * 
 * Body:
 *   { "fixture": "step3", "user_id": "uuid-xxx", "email": "user@example.com" }
 * 
 * Note: email is optional but HIGHLY RECOMMENDED for clean_slate to work properly.
 * The system uses both CF Access user_id AND contact_id (resolved from email).
 */
export async function handleTestSeed(request, env) {
    // Verify secret
    const secret = request.headers.get('X-Test-Secret');
    if (!secret || secret !== env.TEST_SECRET) {
        return jsonResponse({ error: 'Forbidden' }, 403, request);
    }
    
    let body;
    try {
        body = await request.json();
    } catch (e) {
        return jsonResponse({ error: 'Invalid JSON body' }, 400, request);
    }
    
    const { fixture, user_id, email } = body;
    
    if (!fixture) {
        return jsonResponse({ error: 'fixture is required' }, 400, request);
    }
    
    if (!user_id) {
        return jsonResponse({ error: 'user_id is required' }, 400, request);
    }
    
    const validFixtures = ['clean_slate', 'step3', 'last_step', 'completed'];
    if (!validFixtures.includes(fixture)) {
        return jsonResponse({ 
            error: `Invalid fixture. Valid: ${validFixtures.join(', ')}` 
        }, 400, request);
    }
    
    try {
        await applyFixture(env.DB, user_id, fixture, email);
        
        return jsonResponse({
            success: true,
            fixture,
            user_id,
            email: email || null,
            message: `Fixture '${fixture}' applied successfully`
        }, 200, request);
        
    } catch (e) {
        console.error('Fixture error:', e);
        return jsonResponse({ 
            error: 'Failed to apply fixture',
            detail: e.message 
        }, 500, request);
    }
}

