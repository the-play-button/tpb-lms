/**
 * Module End Screen
 * 
 * Displays congratulations screen when course is completed.
 */

import { getState } from '../state.js';

/**
 * Render module end screen
 */
export function renderModuleEndScreen() {
    const signals = getState('signals');
    const course = getState('courseData');
    const viewer = document.getElementById('somViewer');
    
    if (!signals || !course) return;
    
    // Get badges earned from signals
    const badgesEarned = signals.badges_earned || [];
    
    // Build badges HTML
    let badgesHtml = '';
    if (badgesEarned.length > 0) {
        badgesHtml = badgesEarned.map(badge => `
            <div class="badge-earned">
                <span class="badge-icon">🎖️</span>
                <span class="badge-name">${badge.name}</span>
                <span class="badge-points">+${badge.points_reward} pts</span>
            </div>
        `).join('');
    }
    
    // Calculate total points earned
    const basePoints = 200; // Course completion
    const badgePoints = badgesEarned.reduce((sum, b) => sum + (b.points_reward || 0), 0);
    const totalPoints = basePoints + badgePoints;
    
    viewer.innerHTML = `
        <div class="module-end-screen">
            <div class="module-success">
                <div class="success-icon">🎉</div>
                <h1>Félicitations !</h1>
                <p>Vous avez terminé le module "${course.title}".</p>
                <div class="rewards">
                    <p>🏆 +${totalPoints} pts gagnés</p>
                    ${badgesHtml || '<p class="no-new-badge">Continuez pour débloquer plus de badges !</p>'}
                </div>
                <button class="btn-primary" onclick="window.location.href='/'">
                    Retour à l'accueil
                </button>
            </div>
        </div>
    `;
}

