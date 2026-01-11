/**
 * Badges UI Component
 * 
 * Displays earned badges in sidebar with tooltips.
 */

import { getState, subscribe } from '../state.js';

// Exported for use in mobile views (index.js)
export const iconMap = {
    'first_video': '🎬',
    'video_5': '📺',
    'video_25': '🎥',
    'first_quiz': '✅',
    'quiz_10': '🏅',
    'perfect_quiz': '💯',
    'streak_7': '🔥',
    'streak_30': '⚡',
    'course_complete': '📚',
    'course_5': '🎓'
};

const rarityLabels = {
    'common': 'Commun',
    'rare': 'Rare',
    'epic': 'Épique',
    'legendary': 'Légendaire'
};

/**
 * Update badges grid display
 * Shows ALL badges - earned ones have tooltip, locked ones are grayed out
 */
export function updateBadgesGrid() {
    const grid = document.getElementById('badgesGrid');
    if (!grid) return;
    
    const allBadges = getState('allBadges') || [];
    
    if (allBadges.length === 0) {
        grid.innerHTML = '<p class="no-badges">Chargement...</p>';
        return;
    }
    
    grid.innerHTML = allBadges.map(badge => {
        const icon = iconMap[badge.id] || '🏆';
        const rarityClass = badge.rarity ? badge.rarity.toLowerCase() : 'common';
        const rarityLabel = rarityLabels[rarityClass] || 'Commun';
        const points = badge.points_reward || 50;
        const isEarned = badge.earned;
        
        // Locked badges: just icon, grayed out, no tooltip
        if (!isEarned) {
            return `
                <div class="badge-item ${rarityClass} locked" data-badge-id="${badge.id}">
                    ${icon}
                </div>
            `;
        }
        
        // Earned badges: icon + tooltip
        return `
            <div class="badge-item ${rarityClass}" data-badge-id="${badge.id}">
                ${icon}
                <div class="badge-tooltip">
                    <div class="badge-tooltip-header">
                        <span class="badge-tooltip-icon">${icon}</span>
                        <div>
                            <p class="badge-tooltip-title">${badge.name}</p>
                            <span class="badge-tooltip-rarity ${rarityClass}">${rarityLabel}</span>
                        </div>
                    </div>
                    <p class="badge-tooltip-desc">${badge.description}</p>
                    <div class="badge-tooltip-points">⭐ +${points} points</div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Initialize subscriptions
 */
export function initBadges() {
    subscribe('allBadges', updateBadgesGrid);
}

