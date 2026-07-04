/**
 * Admin Dashboard - Statistics Overview
 * 
 * Displays admin-only stats from /api/admin/stats endpoint
 */

import { api } from '../api.js';
import { getState } from '../state.js';
import { setSafeHtml, safeHtml, raw } from '../ui/safe-dom.js';
import { t } from '../../i18n/index.js';

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
        setSafeHtml(container, safeHtml`
            <div class="admin-dashboard">
                <div class="admin-error">
                    <span class="error-icon">🔒</span>
                    <h2>${t('admin.accessDenied')}</h2>
                    <p>${t('admin.adminOnly')}</p>
                    <a href="/" class="back-btn" data-testid="admin-back-home-link">← ${t('endScreen.backToHome')}</a>
                </div>
            </div>
        `);
        return;
    }
    
    const data = stats.stats;

    setSafeHtml(container, safeHtml`
        <div class="admin-dashboard">
            <header class="admin-header">
                <h1>📊 ${t('admin.title')}</h1>
                <p class="admin-subtitle">${t('admin.subtitle')}</p>
            </header>
            
            <div class="stats-grid">
                <div class="stat-card stat-users">
                    <div class="stat-icon">👥</div>
                    <div class="stat-content">
                        <span class="stat-value">${data.total_users || 0}</span>
                        <span class="stat-label">${t('admin.users')}</span>
                    </div>
                </div>
                
                <div class="stat-card stat-courses">
                    <div class="stat-icon">📚</div>
                    <div class="stat-content">
                        <span class="stat-value">${data.total_courses || 0}</span>
                        <span class="stat-label">${t('admin.courses')}</span>
                    </div>
                </div>
                
                <div class="stat-card stat-events">
                    <div class="stat-icon">📈</div>
                    <div class="stat-content">
                        <span class="stat-value">${data.total_events || 0}</span>
                        <span class="stat-label">${t('admin.events')}</span>
                    </div>
                </div>
                
                <div class="stat-card stat-completions">
                    <div class="stat-icon">✅</div>
                    <div class="stat-content">
                        <span class="stat-value">${data.total_completions || 0}</span>
                        <span class="stat-label">${t('admin.completions')}</span>
                    </div>
                </div>
                
                <div class="stat-card stat-badges">
                    <div class="stat-icon">🏆</div>
                    <div class="stat-content">
                        <span class="stat-value">${data.total_badges_earned || 0}</span>
                        <span class="stat-label">${t('admin.badges')}</span>
                    </div>
                </div>
                
                <div class="stat-card stat-xp">
                    <div class="stat-icon">⚡</div>
                    <div class="stat-content">
                        <span class="stat-value">${(data.total_xp || 0).toLocaleString()}</span>
                        <span class="stat-label">${t('admin.xpTotal')}</span>
                    </div>
                </div>
            </div>
            
            ${data.recent_activity ? raw(safeHtml`
            <section class="admin-section">
                <h2>📋 ${t('admin.recentActivity')}</h2>
                <div class="activity-list">
                    ${raw(data.recent_activity.map(({ type, user_email, action, created_at } = {}) => safeHtml`
                        <div class="activity-item">
                            <span class="activity-icon">${getActivityIcon(type)}</span>
                            <span class="activity-user">${user_email || t('admin.anonymous')}</span>
                            <span class="activity-action">${action || type}</span>
                            <span class="activity-time">${formatRelativeTime(created_at)}</span>
                        </div>
                    `).join(''))}
                </div>
            </section>
            `) : ''}
            
            <footer class="admin-footer">
                <a href="/" class="back-btn" data-testid="admin-back-lms-link">← ${t('admin.backToLms')}</a>
            </footer>
        </div>
    `);
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
    
    if (diff < 60) return t('admin.timeNow');
    if (diff < 3600) return t('admin.timeMinutes', { n: Math.floor(diff / 60) });
    if (diff < 86400) return t('admin.timeHours', { n: Math.floor(diff / 3600) });
    if (diff < 604800) return t('admin.timeDays', { n: Math.floor(diff / 86400) });

    return date.toLocaleDateString();
}

/**
 * Initialize admin dashboard
 * Called when user navigates to /admin
 */
export const initAdminDashboard = async () => {
    const container = document.getElementById('somViewer');
    if (!container) return;
    
    setSafeHtml(container, safeHtml`
        <div class="admin-dashboard">
            <div class="admin-loading">
                <div class="spinner"></div>
                <p>${t('admin.loadingStats')}</p>
            </div>
        </div>
    `);
    
    await renderAdminDashboard(container);
};

