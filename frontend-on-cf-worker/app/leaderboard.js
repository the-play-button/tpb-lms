/**
 * Leaderboard
 * 
 * Displays ranking of users by points.
 */

import { api } from './api.js';
import { formatNumber } from './utils.js';
import { log } from './log.js';
import { setSafeHtml, safeHtml } from './ui/safe-dom.js';
import { t } from '../i18n/index.js';

/**
 * Load leaderboard from API
 */
export const loadLeaderboard = async () => {
    try {
        const data = await api('/leaderboard?limit=10');
        renderLeaderboard(data.leaderboard || [], data.currentUser);
    } catch (error) {
        log.warn('Failed to load leaderboard:', error.message);
        renderLeaderboard([], null); // explicit fallback — empty state instead of stale UI
    }
};

/**
 * Render leaderboard entries
 */
const renderLeaderboard = (entries, currentUser) => {
    const list = document.getElementById('leaderboardList');
    if (!list) return;
    
    if (entries.length === 0) {
        setSafeHtml(list, safeHtml`<li class="empty">${t('leaderboard.empty')}</li>`);
        return;
    }
    
    setSafeHtml(list, entries.map((entry = {}) => safeHtml`
        <li ${entry.user_id === currentUser?.id ? 'class="current-user"' : ''}>
            <span class="rank">#${entry.rank}</span>
            <span class="leaderboard-name">${entry.user?.email || entry.user?.name || t('admin.anonymous')}</span>
            <span class="leaderboard-xp">${formatNumber(entry.total_points)} pts</span>
        </li>
    `).join(''));
}

