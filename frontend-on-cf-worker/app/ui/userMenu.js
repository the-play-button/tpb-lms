/**
 * User Menu Component
 * 
 * Displays user email, role badge, and logout button in the header.
 * Logout redirects to Cloudflare Access logout endpoint.
 */

// CF Access logout URL for TPB team
const CF_ACCESS_LOGOUT_URL = 'https://theplaybutton.cloudflareaccess.com/cdn-cgi/access/logout';

/**
 * Initialize user menu
 * @param {Object} user - User object with email
 * @param {Object} profile - User profile with role info
 */
export function initUserMenu(user, profile) {
    const container = document.getElementById('userMenu');
    if (!container) {
        console.warn('User menu container not found');
        return;
    }
    
    const email = user?.email || 'Utilisateur';
    const role = profile?.role || 'student';
    const displayRole = getRoleDisplay(role);
    
    container.innerHTML = `
        <div class="user-menu-content">
            <div class="user-info-compact">
                <span class="user-email" title="${email}">${truncateEmail(email)}</span>
                <span class="user-role-badge ${role}">${displayRole}</span>
            </div>
            ${role === 'admin' ? `<a href="/admin" class="admin-link" title="Dashboard Admin">📊</a>` : ''}
            <button class="logout-btn" onclick="window.location.href='${CF_ACCESS_LOGOUT_URL}'" title="Se déconnecter">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                <span class="logout-text">Déconnexion</span>
            </button>
        </div>
    `;
}

/**
 * Get display text for role
 */
function getRoleDisplay(role) {
    const roles = {
        'admin': 'Admin',
        'instructor': 'Instructeur',
        'student': 'Étudiant'
    };
    return roles[role] || role;
}

/**
 * Truncate long email addresses
 */
function truncateEmail(email) {
    if (!email) return '';
    if (email.length <= 25) return email;
    
    const [local, domain] = email.split('@');
    if (!domain) return email;
    
    const truncatedLocal = local.length > 12 ? local.substring(0, 12) + '…' : local;
    return `${truncatedLocal}@${domain}`;
}
