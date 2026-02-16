/**
 * Get or create contact in crm_contact (Unified.to aligned)
 */

export async function getOrCreateContact(email, env) {
    // Try to find existing contact
    let contact = await env.DB.prepare(`
        SELECT * FROM crm_contact
        WHERE json_extract(emails_json, '$[0].email') = ?
           OR id = ?
    `).bind(email, email).first();

    if (contact) return contact;

    // Create new contact
    const id = `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const emailsJson = JSON.stringify([{ email, type: 'WORK' }]);

    await env.DB.prepare(`
        INSERT INTO crm_contact (id, emails_json, created_at, updated_at)
        VALUES (?, ?, ?, ?)
    `).bind(id, emailsJson, now, now).run();

    return {
        id,
        emails_json: emailsJson,
        created_at: now,
        updated_at: now
    };
}
