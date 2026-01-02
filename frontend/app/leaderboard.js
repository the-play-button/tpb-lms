/**
 * Leaderboard
 * 
 * Displays ranking of users by points.
 */

import { api } from './api.js';
import { formatNumber } from './utils.js';

/**
 * Load leaderboard from API
 */
export async function loadLeaderboard() {
    try {
        const data = await api('/leaderboard?limit=10');
        renderLeaderboard(data.leaderboard || [], data.currentUser);
    } catch (error) {
        console.warn('Failed to load leaderboard:', error.message);
    }
}

/**
 * Render leaderboard entries
 */
function renderLeaderboard(entries, currentUser) {
    const list = document.getElementById('leaderboardList');
    if (!list) return;
    
    if (entries.length === 0) {
        list.innerHTML = '<li class="empty">Pas encore de données</li>';
        return;
    }
    
    list.innerHTML = entries.map(entry => `
        <li ${entry.user_id === currentUser?.id ? 'class="current-user"' : ''}>
            <span class="rank">#${entry.rank}</span>
            <span class="leaderboard-name">${entry.user?.email || entry.user?.name || 'Anonyme'}</span>
            <span class="leaderboard-xp">${formatNumber(entry.total_points)} pts</span>
        </li>
    `).join('');
}

