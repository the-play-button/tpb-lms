/**
 * Notifications
 * 
 * Handles toasts, modals, errors, and user data refresh.
 */

import { api } from './api.js';
import { getState, setState } from './state.js';
import { iconMap } from './ui/badges.js';

function createBadgeParticles(container) {
    const particlesDiv = document.createElement('div');
    particlesDiv.className = 'badge-particles';
    
    for (let i = 0; i < 12; i++) {
        const particle = document.createElement('span');
        const angle = (i / 12) * Math.PI * 2;
        const distance = 80 + Math.random() * 40;
        particle.style.setProperty('--tx', `${Math.cos(angle) * distance}px`);
        particle.style.setProperty('--ty', `${Math.sin(angle) * distance}px`);
        particle.style.animationDelay = `${i * 0.05}s`;
        particlesDiv.appendChild(particle);
    }
    
    container.appendChild(particlesDiv);
    setTimeout(() => particlesDiv.remove(), 1500);
}

/**
 * Show badge modal (unified for earned events and mobile tap)
 * @param {Object} badge - Badge data
 * @param {Object} options - Display options
 * @param {boolean} options.isEarned - Whether badge is earned (default: true for backward compat)
 */
export function showBadgeModal(badge, options = {}) {
    const { isEarned = true } = options;
    
    const modal = document.getElementById('badgeModal');
    if (!modal) return;
    
    const emojiEl = document.getElementById('badgeModalEmoji');
    const iconEl = document.getElementById('badgeModalIcon');
    const titleEl = document.getElementById('badgeModalTitle');
    const nameEl = document.getElementById('badgeModalName');
    const descEl = document.getElementById('badgeModalDescription');
    const xpEl = document.getElementById('badgeModalXP');
    const contentEl = modal.querySelector('.modal-content');
    
    // Get emoji icon from map
    const icon = iconMap[badge.id] || '🏆';
    
    // Show emoji, hide img (consistent display)
    if (emojiEl) {
        emojiEl.textContent = icon;
        emojiEl.style.display = 'block';
    }
    if (iconEl) {
        iconEl.style.display = 'none';
    }
    
    // Title based on earned status
    if (titleEl) {
        titleEl.textContent = isEarned ? 'Badge Débloqué!' : 'Badge Verrouillé';
    }
    
    // Content: hide details for locked badges (no spoilers!)
    if (isEarned) {
        if (nameEl) nameEl.textContent = badge.name;
        if (descEl) descEl.textContent = badge.description || 'Félicitations !';
        if (xpEl) xpEl.textContent = `+${badge.points_reward || 0} pts`;
    } else {
        // Locked: mystery content
        if (nameEl) nameEl.textContent = '???';
        if (descEl) descEl.textContent = 'Continue pour débloquer ce badge';
        if (xpEl) xpEl.textContent = '🔒';
    }
    
    // Style for locked vs earned
    if (contentEl) {
        contentEl.classList.toggle('badge-locked', !isEarned);
        contentEl.classList.toggle('badge-earned', isEarned);
    }
    
    modal.classList.add('active');
    
    // Effet particules si badge gagne
    if (isEarned) {
        createBadgeParticles(contentEl);
    }
}

/**
 * Close badge modal
 */
export function closeBadgeModal() {
    document.getElementById('badgeModal')?.classList.remove('active');
}

/**
 * Show error message
 */
export function showError(message) {
    const viewer = document.getElementById('somViewer');
    if (viewer) {
        viewer.innerHTML = `
            <div class="welcome-screen">
                <h1>Erreur</h1>
                <p>${message}</p>
                <p>Veuillez réessayer ou contacter le support.</p>
            </div>
        `;
    }
}

/**
 * Refresh user data from API and update state
 * This triggers automatic UI updates via state subscriptions
 */
export async function refreshUserData() {
    try {
        const session = await api('/auth/session');
        
        // Update profile (triggers updateUserStats)
        setState('profile', session.profile);
        
        // Update badges
        const badges = session.badges || [];
        setState('badges', badges);
        
        // Update earned status in allBadges (triggers updateBadgesGrid)
        const earnedIds = new Set(badges.map(b => b.id));
        const allBadges = getState('allBadges') || [];
        const updatedBadges = allBadges.map(badge => ({
            ...badge,
            earned: earnedIds.has(badge.id)
        }));
        setState('allBadges', updatedBadges);
        
    } catch (error) {
        console.warn('Failed to refresh user data:', error.message);
    }
}

/**
 * Initialize notifications (expose to window)
 */
export function initNotifications() {
    window.closeBadgeModal = closeBadgeModal;
}

