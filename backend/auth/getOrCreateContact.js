/**
 * Get or create contact in crm_contact (Unified.to aligned)
 */

export const getOrCreateContact = async (email, env) => {
    let contact = await env.DB.prepare(`
        SELECT * FROM crm_contact
        WHERE id IN (
            SELECT cc.id FROM crm_contact cc, json_each(cc.emails_json) je
            WHERE json_extract(je.value, '$.email') = ?
        ) OR id = ?
    `).bind(email, email).first();

    if (contact) return contact;

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
};
