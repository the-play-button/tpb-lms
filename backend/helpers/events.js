/**
 * Events Helper
 * 
 * Shared utilities for event handling across handlers.
 * Factorized from quiz.js and events.js (GAP-1501)
 */

/**
 * Generate unique event ID
 * Format: evt_{timestamp}_{random}
 */
export function generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Store event in lms_event table
 * 
 * @param {D1Database} db - D1 database instance
 * @param {Object} params - Event parameters
 * @param {string} params.type - Event type (VIDEO_PING, QUIZ_SUBMIT, etc.)
 * @param {string} params.userId - User ID
 * @param {string} params.courseId - Course ID
 * @param {string} params.classId - Class ID
 * @param {Object} params.payload - Event payload
 * @returns {Promise<string>} - Generated event ID
 */
export async function storeEvent(db, { type, userId, courseId, classId, payload }) {
    const eventId = generateEventId();
    const now = new Date().toISOString();
    
    await db.prepare(`
        INSERT INTO lms_event (id, type, user_id, course_id, class_id, occurred_at, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(eventId, type, userId, courseId, classId, now, JSON.stringify(payload)).run();
    
    return eventId;
}

