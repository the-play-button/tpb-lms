// entropy-single-export-ok: render + init pattern
/**
 * Admin Dashboard - Statistics Overview
 * 
 * Displays admin-only stats from /api/admin/stats endpoint
 */

import { api } from '../api.js';
import { getState } from '../state.js';

const loadAdminStats = async () => {
    try {
        return await api('/admin/stats');
    } catch (err) {
        console.error('Admin stats error:', err);
        return null;
    }
};

/**
 * Render admin dashboard HTML
 */
export const renderAdminDashboard = async container => {
    const stats = await loadAdminStats();
    
    if (!stats || !stats.success) {
        container.innerHTML = `
            <div class="admin-dashboard">
                <div class="admin-error">
                    <span class="error-icon">🔒</span>
                    <h2>Accès refusé</h2>
                    <p>Cette page est réservée aux administrateurs.</p>
                    <a href="/" class="back-btn">← Retour à l'accueil</a>
                </div>
            </div>
        `;
        return;
    }
    
    const data = stats.stats;
    
    container.innerHTML = `
        <div class="admin-dashboard">
            <header class="admin-header">
                <h1>📊 Dashboard Admin</h1>
                <p class="admin-subtitle">Vue d'ensemble du système LMS</p>
            </header>
            
            <div class="stats-grid">
                <div class="stat-card stat-users">
                    <div class="stat-icon">👥</div>
                    <div class="stat-content">
                        <span class="stat-value">${data.total_users || 0}</span>
                        <span class="stat-label">Utilisateurs</span>
                    </div>
                </div>
                
                <div class="stat-card stat-courses">
                    <div class="stat-icon">📚</div>
                    <div class="stat-content">
                        <span class="stat-value">${data.total_courses || 0}</span>
                        <span class="stat-label">Cours</span>
                    </div>
                </div>
                
                <div class="stat-card stat-events">
                    <div class="stat-icon">📈</div>
                    <div class="stat-content">
                        <span class="stat-value">${data.total_events || 0}</span>
                        <span class="stat-label">Événements trackés</span>
                    </div>
                </div>
                
                <div class="stat-card stat-completions">
                    <div class="stat-icon">✅</div>
                    <div class="stat-content">
                        <span class="stat-value">${data.total_completions || 0}</span>
                        <span class="stat-label">Cours complétés</span>
                    </div>
                </div>
                
                <div class="stat-card stat-badges">
                    <div class="stat-icon">🏆</div>
                    <div class="stat-content">
                        <span class="stat-value">${data.total_badges_earned || 0}</span>
                        <span class="stat-label">Badges débloqués</span>
                    </div>
                </div>
                
                <div class="stat-card stat-xp">
                    <div class="stat-icon">⚡</div>
                    <div class="stat-content">
                        <span class="stat-value">${(data.total_xp || 0).toLocaleString()}</span>
                        <span class="stat-label">XP Total distribué</span>
                    </div>
                </div>
            </div>
            
            ${data.recent_activity ? `
            <section class="admin-section">
                <h2>📋 Activité récente</h2>
                <div class="activity-list">
                    ${data.recent_activity.map(({ type, user_email, action, created_at } = {}) => `
                        <div class="activity-item">
                            <span class="activity-icon">${getActivityIcon(type)}</span>
                            <span class="activity-user">${user_email || 'Anonyme'}</span>
                            <span class="activity-action">${action || type}</span>
                            <span class="activity-time">${formatRelativeTime(created_at)}</span>
                        </div>
                    `).join('')}
                </div>
            </section>
            ` : ''}
            
            <footer class="admin-footer">
                <a href="/" class="back-btn">← Retour au LMS</a>
            </footer>
        </div>
    `;
};

/**
 * Get emoji icon for activity type
 */
const getActivityIcon = (type) => {
    const icons = {
        'VIDEO_PING': '📺',
        'VIDEO_COMPLETE': '✅',
        'QUIZ_SUBMIT': '📝',
        'BADGE_EARNED': '🏆',
        'COURSE_COMPLETE': '🎉',
        'LOGIN': '🔑'
    };
    return icons[type] || '📍';
}

/**
 * Format timestamp to relative time
 */
const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';
    
    const now = new Date();
    const date = new Date(timestamp);
    const diff = Math.floor((now - date) / 1000); // seconds
    
    if (diff < 60) return 'À l\'instant';
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
    if (diff < 604800) return `Il y a ${Math.floor(diff / 86400)} j`;
    
    return date.toLocaleDateString('fr-FR');
}

/**
 * Initialize admin dashboard
 * Called when user navigates to /admin
 */
export const initAdminDashboard = async () => {
    const container = document.getElementById('somViewer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="admin-dashboard">
            <div class="admin-loading">
                <div class="spinner"></div>
                <p>Chargement des statistiques...</p>
            </div>
        </div>
    `;
    
    await renderAdminDashboard(container);
};

