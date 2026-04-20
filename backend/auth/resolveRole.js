/**
 * Resolve user role from email via bastion IAM.
 *
 * Direct fetch to bastion — fail hard on error, no fallback.
 * 404 = user has no IAM roles = student (expected for regular users).
 */

import { log } from '@the-play-button/tpb-sdk-js';

export const resolveRole = async (email, env) => {
    const resp = await fetch(
        `${env.BASTION_URL}/iam/users/${encodeURIComponent(email)}/roles`,
        { headers: { 'Authorization': `Bearer ${env.BASTION_TOKEN}` } }
    );

    // 404 = user has no IAM roles = student (not an error)
    if (resp.status === 404) return 'student';

    if (!resp.ok) {
        throw new Error(`[resolveRole] bastion IAM failed: ${resp.status} ${await resp.text()}`);
    }

    const data = await resp.json();
    const roleNames = (data.roles || []).map(({ name } = {}) => name);

    if (roleNames.some(r => r === 'tpblms_admin')) return 'admin';
    if (roleNames.some(r => r === 'tpblms_instructor')) return 'instructor';
    return 'student';
};
