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

export async function resolveRole(email, env) {
    // Try vault-api first (SSOT for IAM)
    if (env.BASTION_URL && env.VAULT_TOKEN) {
        try {
            const vault = new VaultClient(env.BASTION_URL, env);
            const data = await vault.getUserRoles(email);
            const roleNames = (data.roles || []).map(({ name }) => name);

            // LMS-SPECIFIC MAPPING (this logic belongs to LMS, not vault-api)
            // Namespace is 'tpblms' so roles are tpblms_admin, tpblms_instructor
            if (roleNames.some(r => r === 'tpblms_admin')) {
                return 'admin';
            }
            if (roleNames.some(r => r === 'tpblms_instructor')) {
                return 'instructor';
            }

            // No matching LMS role found = student
            return 'student';

        } catch (err) {
            console.error('vault-api role resolution failed, falling back to local:', err.message);
            // Fall through to local resolution
        }
    }

    // Fallback: local hris_employee check
    // entropy-legacy-marker-ok: documented technical debt
    // This will be deprecated once vault-api is fully operational
    const employee = await env.DB.prepare(`
    SELECT he.id, he.employee_roles_json FROM hris_employee he, json_each(he.emails_json) je
    WHERE json_extract(je.value, '$.email') = ?
  `).bind(email).first();

    if (employee) {
        const roles = JSON.parse(employee.employee_roles_json || '[]');
        if (roles.includes('admin')) return 'admin';
        return 'instructor';
    }

    // Default: student (external user)
    return 'student';
}
