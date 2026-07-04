/**
 * Notifications
 * 
 * Handles toasts, modals, errors, and user data refresh.
 */

import { api } from './api.js';
import { getState, setState } from './state.js';
import { iconMap } from './ui/badges.js';
import { log } from './log.js';
import { setSafeHtml, escapeHtml , safeHtml} from './ui/safe-dom.js';
import { t } from '../i18n/index.js';

const BADGE_PARTICLE_COUNT = 12;

const createBadgeParticles = container => {
    const particlesDiv = document.createElement('div');
    particlesDiv.className = 'badge-particles';

    // Use a CSPRNG even for the visual jitter — Math.random is flagged by
    // bearer § insufficiently-random-values, and crypto.getRandomValues is
    // free here (= 12 particles, one-shot). Buffer holds Uint32 samples
    // normalised to [0, 1).
    const randomBuf = new Uint32Array(BADGE_PARTICLE_COUNT);
    crypto.getRandomValues(randomBuf);

    for (let i = 0; i < BADGE_PARTICLE_COUNT; i++) {
        const particle = document.createElement('span');
        const angle = (i / BADGE_PARTICLE_COUNT) * Math.PI * 2;
        const jitter = randomBuf[i] / 0xffffffff;
        const distance = 80 + jitter * 40;
        particle.style.setProperty('--tx', `${Math.cos(angle) * distance}px`);
        particle.style.setProperty('--ty', `${Math.sin(angle) * distance}px`);
        particle.style.animationDelay = `${i * 0.05}s`;
        particlesDiv.appendChild(particle);
    }

    container.appendChild(particlesDiv);

    // Signal-based cleanup : when the last CSS animation ends, the parent
    // div has nothing more to render — remove. animationend bubbles from
    // child <span> elements per the W3C Animation spec.
    let ended = 0;
    particlesDiv.addEventListener('animationend', () => {
        ended += 1;
        if (ended >= BADGE_PARTICLE_COUNT) particlesDiv.remove();
    });
};

/**
 * Show badge modal (unified for earned events and mobile tap)
 * @param {Object} badge - Badge data
 * @param {Object} options - Display options
 * @param {boolean} options.isEarned - Whether badge is earned. Default true matches the original « earned-event » call site, the most common path.
 */
export const showBadgeModal = (badge, options = {}) => {
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
    
    const icon = iconMap[badge.id] || '🏆';
    
    if (emojiEl) {
        emojiEl.textContent = icon;
        emojiEl.style.display = 'block';
    }
    if (iconEl) {
        iconEl.style.display = 'none';
    }
    
    if (titleEl) {
        titleEl.textContent = isEarned ? t('badge.unlocked') : t('badge.locked');
    }

    if (isEarned) {
        if (nameEl) nameEl.textContent = badge.name;
        if (descEl) descEl.textContent = badge.description || t('badge.earned');
        if (xpEl) xpEl.textContent = `+${badge.points_reward || 0} pts`;
    } else {
        if (nameEl) nameEl.textContent = '???';
        if (descEl) descEl.textContent = t('badge.continueToUnlock');
        if (xpEl) xpEl.textContent = '🔒';
    }
    
    if (contentEl) {
        contentEl.classList.toggle('badge-locked', !isEarned);
        contentEl.classList.toggle('badge-earned', isEarned);
    }
    
    modal.classList.add('active');
    
    if (isEarned) {
        createBadgeParticles(contentEl);
    }
};

/**
 * Close badge modal
 */
export const closeBadgeModal = () => {
    document.getElementById('badgeModal')?.classList.remove('active');
};

/**
 * Show error message
 */
export const showError = message => {
    const viewer = document.getElementById('somViewer');
    if (viewer) {
        const escaped = escapeHtml(message);
        setSafeHtml(viewer, safeHtml`
            <div class="welcome-screen">
                <h1>${t('errors.title')}</h1>
                <p>${escaped}</p>
                <p>${t('errors.contactSupport')}</p>
            </div>
        `);
    }
};

/**
 * Refresh user data from API and update state
 * This triggers automatic UI updates via state subscriptions
 */
export const refreshUserData = async () => {
    try {
        const session = await api('/auth/session');
        
        setState('profile', session.profile);
        
        const badges = session.badges || [];
        setState('badges', badges);
        
        const earnedIds = new Set(badges.map(({ id } = {}) => id));
        const allBadges = getState('allBadges') || [];
        const updatedBadges = allBadges.map(badge => ({
            ...badge,
            earned: earnedIds.has(badge.id)
        }));
        setState('allBadges', updatedBadges);
        
    } catch (error) {
        log.warn('Failed to refresh user data:', error.message);
        setState('userDataStale', true); // explicit recovery — UI can show "refresh needed" badge
    }
};

/**
 * Initialize notifications (= no-op currently ; window.closeBadgeModal
 * exposure lives in app/init/globals.js per § global_pollution doctrine).
 */
export const initNotifications = () => {};

