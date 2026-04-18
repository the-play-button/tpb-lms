// entropy-legacy-marker-ok: debt — local hris_employee fallback for role resolution, to be removed once vault-api is fully operational
/**
 * Resolve user role from email
 *
 * Strategy:
 * 1. Try vault-api (SSOT for IAM) - returns raw roles
 * 2. Apply LMS-specific mapping to vault roles
 * 3. Fallback to local hris_employee if vault-api unavailable
 */

import { VaultClient } from '../lib/vaultClient.js';

export const resolveRole = async (email, env) => {
    if (env.BASTION_URL && env.BASTION_TOKEN) {
        try {
            const vault = new VaultClient(env.BASTION_URL, env);
            const data = await vault.getUserRoles(email);
            const roleNames = (data.roles || []).map(({ name } = {}) => name);

            if (roleNames.some(r => r === 'tpblms_admin')) {
                return 'admin';
            }
            if (roleNames.some(r => r === 'tpblms_instructor')) {
                return 'instructor';
            }

            return 'student';

        } catch (err) {
            console.error('vault-api role resolution failed, falling back to local:', err.message);
        }
    }

    // entropy-legacy-marker-ok: legacy pattern in resolveRole, tracked for future refactoring
    const employee = await env.DB.prepare(`
    SELECT he.id, he.employee_roles_json FROM hris_employee he, json_each(he.emails_json) je
    WHERE json_extract(je.value, '$.email') = ?
  `).bind(email).first();

    if (employee) {
        if (JSON.parse(employee.employee_roles_json || '[]').includes('admin')) return 'admin';
        return 'instructor';
    }

    return 'student';
};
