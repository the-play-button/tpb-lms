// entropy-high-coupling-ok: SPA entry point
// entropy-lines-exceeded-ok: SPA entry point, split tracked separately
/**
 * LMS Frontend Application
 * 
 * Main entry point - orchestrates all modules.
 * 
 * Architecture:
 * - Reactive state (state.js) - setState triggers subscribed UI updates
 * - Modular components (ui/, course/, video/, quiz/)
 * - Event-based backend communication (VIDEO_PING, QUIZ_SUBMIT)
 */

import { setState, getState } from './state.js';
import { api } from './api.js';
import { log } from './log.js';

import { updateUserStats, initUserStats } from './ui/userStats.js';
import { updateBadgesGrid, initBadges, iconMap } from './ui/badges.js';
import { renderCourseList, initCourseList } from './ui/courseList.js';
import { initUserMenu } from './ui/userMenu.js';
import { renderLangSelector, initLangSelector } from './ui/langSelector.js';

// i18n
import { initLanguage, t, getLanguage } from '../i18n/index.js';

import { loadCourse } from './course/loader.js';
import { initNavigation } from './course/navigation.js';
import { renderCurrentStep } from './course/renderer.js';

import { stopVideoTracking, pauseVideo, isVideoPlaying } from './video/tracking/index.js';
import { initQuizHandler, handleTallySubmission } from './quiz/handler.js';

import { loadLeaderboard } from './leaderboard.js';
import { showBadgeModal, showError, refreshUserData, initNotifications } from './notifications.js';

import { initDebugCollector, setUserContext } from './debug/collector/index.js';
import { initDebugFab } from './debug/fab.js';

import { initAdminDashboard } from './admin/dashboard.js';

import { initKmsLinks } from './kms/viewer/index.js';

const init = async () => {
    initDebugCollector();
    initDebugFab();
    
    try {
        // 1. Get session from API
        const session = await api('/auth/session');
        setState('user', session.user);
        setState('profile', session.profile);
        setState('badges', session.badges || []);
        
        log.info('🔐 Session loaded:', session.user.email);
        
        if (window.Sentry) {
            window.Sentry.setUser({
                id: session.profile?.contact_id || session.user.id,
                email: session.user.email
            });
        }
        
        setUserContext({
            email: session.user.email,
            id: session.user.id,
            contact_id: session.profile?.contact_id
        });
        
        // 2. Get available courses (with language for translations)
        const lang = getLanguage();
        const { courses } = await api(`/courses?lang=${lang}`);
        setState('courses', courses);
        
        // 3. Get all badge definitions
        const badgeData = await api('/badges');
        setState('allBadges', badgeData.badges || []);
        
        // 4. Initialize subscriptions (reactive UI)
        initUserStats();
        initBadges();
        initCourseList();
        
        // 5. Initial render
        updateUserStats();
        renderCourseList();
        updateBadgesGrid();
        
        // 6. Setup event listeners
        setupEventListeners();
        
        // 7. Expose global functions
        initNavigation();
        initQuizHandler();
        initNotifications();
        
        // 8. Load leaderboard
        loadLeaderboard();
        
        // 8b. Initialize KMS link handling
        initKmsLinks();
        
        // 9. Initialize user menu with logout button
        initUserMenu(session.user, session.profile);
        
        // 9b. Initialize language selector
        initLangSelectorInHeader();
        
        // 10. Check for admin route
        if (window.location.pathname === '/admin') {
            initAdminDashboard();
            return; // Don't load courses on admin page
        }
        
        // 11. Check URL for direct course link (GAP-203: support ?step=N)
        const urlParams = new URLSearchParams(window.location.search);
        const courseId = urlParams.get('som') || urlParams.get('course');
        const stepParam = urlParams.get('step');
        const initialStep = stepParam !== null ? Math.max(0, parseInt(stepParam, 10) - 1) : null; // Convertir 1-based vers 0-based
        
        if (courseId) {
            loadCourse(courseId, initialStep);
        } else if (courses.length > 0) {
            loadCourse(courses[0].id, initialStep);
        }
        
    } catch (error) {
        log.error('Failed to initialize:', error);
        showError(error.message);
    }
};

/**
 * Initialize language selector in header
 */
const initLangSelectorInHeader = () => {
    const userMenu = document.getElementById('userMenu');
    if (!userMenu) return;
    
    const langContainer = document.createElement('div');
    langContainer.innerHTML = renderLangSelector();
    userMenu.parentElement.insertBefore(langContainer.firstElementChild, userMenu);
    
    initLangSelector();
}

const initMobileTabs = () => {
    const mobileTabs = document.getElementById('mobileTabs');
    const content = document.querySelector('.lms-content');
    const parcoursView = document.getElementById('mobileParcoursView');
    const badgesView = document.getElementById('mobileBadgesView');
    
    if (!mobileTabs) return;
    
    populateMobileCourseList();
    populateMobileBadgesGrid();
    
    mobileTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.mobile-tab');
        if (!tab) return;
        
        const target = tab.dataset.tab;
        
        mobileTabs.querySelectorAll('.mobile-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        content?.classList.remove('mobile-hidden');
        parcoursView?.classList.remove('visible');
        badgesView?.classList.remove('visible');
        
        switch (target) {
            case 'content':
                break;
                
            case 'parcours':
                content?.classList.add('mobile-hidden');
                parcoursView?.classList.add('visible');
                populateMobileCourseList(); // Refresh data
                break;
                
            case 'badges':
                content?.classList.add('mobile-hidden');
                badgesView?.classList.add('visible');
                populateMobileBadgesGrid(); // Refresh data
                break;
        }
    });
};

/**
 * Populate mobile course list from state
 */
const populateMobileCourseList = () => {
    const container = document.getElementById('mobileCourseList');
    if (!container) return;
    
    const courses = getState('courses') || [];
    const currentCourse = getState('currentCourse');
    
    container.innerHTML = courses.map(course => {
        const isCompleted = course.progress?.course_completed;
        const stepsCompleted = course.progress?.steps_completed || 0;
        const isCurrentCourse = course.id === currentCourse;
        let statusText;
        if (isCompleted) {
            statusText = '✅ Terminé';
        } else if (isCurrentCourse) {
            statusText = '▶️ En cours';
        } else if (stepsCompleted > 0) {
            statusText = `${stepsCompleted} étapes`;
        } else {
            statusText = 'Non commencé';
        }
        
        return `
            <div class="course-item ${isCurrentCourse ? 'active' : ''}" 
                 data-course-id="${course.id}">
                <div class="course-name">${course.title || course.name}</div>
                <div class="course-progress">${statusText}</div>
            </div>
        `;
    }).join('');
    
    container.querySelectorAll('.course-item').forEach(item => { // entropy-event-listeners-ok: one-time setup after render
        item.addEventListener('click', () => {
            const courseId = item.dataset.courseId;
            loadCourse(courseId);
            history.pushState({}, '', `?som=${courseId}`);
            
            switchToContentTab();
        });
    });
}

/**
 * Populate mobile badges grid from state
 * Tap on badge opens detail modal
 */
const populateMobileBadgesGrid = () => {
    const container = document.getElementById('mobileBadgesGrid');
    if (!container) return;
    
    const allBadges = getState('allBadges') || [];
    const earnedBadges = getState('badges') || [];
    const earnedIds = new Set(earnedBadges.map(({ badge_id, id }) => badge_id || id));
    
    container.innerHTML = allBadges.map((badge, index) => {
        const isEarned = earnedIds.has(badge.id);
        const icon = iconMap[badge.id] || '🏆'; // iconMap imported from badges.js
        return `
            <div class="badge-item ${isEarned ? 'earned' : 'locked'}" 
                 data-badge-index="${index}">
                <span class="badge-icon">${icon}</span>
                <span class="badge-name">${badge.name}</span>
            </div>
        `;
    }).join('');
    
    const hintEl = document.querySelector('.mobile-badges-view .badge-hint');
    if (!hintEl) {
        const hint = document.createElement('p');
        hint.className = 'badge-hint';
        hint.textContent = 'Appuie sur un badge pour voir les détails';
        container.parentElement?.appendChild(hint);
    }
    
    container.querySelectorAll('.badge-item').forEach(item => { // entropy-event-listeners-ok: one-time setup after render
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.badgeIndex, 10);
            const badge = allBadges[index];
            if (badge) {
                showBadgeModal(badge, { isEarned: earnedIds.has(badge.id) });
            }
        });
    });
}

/**
 * Switch mobile view back to content tab
 */
const switchToContentTab = () => {
    const mobileTabs = document.getElementById('mobileTabs');
    const content = document.querySelector('.lms-content');
    const parcoursView = document.getElementById('mobileParcoursView');
    const badgesView = document.getElementById('mobileBadgesView');
    
    parcoursView?.classList.remove('visible');
    badgesView?.classList.remove('visible');
    content?.classList.remove('mobile-hidden');
    
    mobileTabs?.querySelectorAll('.mobile-tab').forEach(t => t.classList.remove('active'));
    mobileTabs?.querySelector('[data-tab="content"]')?.classList.add('active');
}

/**
 * Setup DOM event listeners
 */
const setupEventListeners = () => {
    initMobileTabs();
    
    document.getElementById('somList')?.addEventListener('click', (e) => {
        const link = e.target.closest('a[data-som-id]');
        if (link) {
            e.preventDefault();
            const courseId = link.dataset.somId;
            loadCourse(courseId);
            history.pushState({}, '', `?som=${courseId}`);
        }
    });
    
    document.querySelector('.leaderboard-tabs')?.addEventListener('click', (e) => {
        if (e.target.matches('.tab')) {
            document.querySelectorAll('.leaderboard-tabs .tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            loadLeaderboard();
        }
    });
    
    window.addEventListener('lms:xp-earned', (e) => {
        showToast(`+${e.detail.xp} XP`, 'points');
        refreshUserData();
    });
    
    window.addEventListener('lms:badge-earned', (e) => {
        showToast(`Badge débloqué : ${e.detail.name}`, 'achievement');
        showBadgeModal(e.detail);
        refreshUserData();
    });
    
    window.addEventListener('beforeunload', () => {
        stopVideoTracking();
    });
    
    window.addEventListener('languagechange', async (e) => {
        log.debug('🌐 Language changed to:', e.detail.lang);
        try {
            const currentStepIndex = getState('currentStepIndex');
            
            const { courses } = await api(`/courses?lang=${e.detail.lang}`);
            setState('courses', courses);
            
            const currentCourse = getState('currentCourse');
            if (currentCourse) {
                const course = await api(`/courses/${currentCourse}?lang=${e.detail.lang}`);
                setState('courseData', course);
                
                setState('currentStepIndex', currentStepIndex);
                renderCurrentStep();
            }
        } catch (error) {
            log.error('Failed to reload with new language:', error);
        }
    });
    
    window.addEventListener('message', async (event) => {
        if (!event.origin.includes('tally.so')) {
            return;
        }
        
        log.debug('📨 [TALLY] postMessage:', event.data);
        
        let tallyEvent;
        try {
            tallyEvent = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        } catch (e) {
            return; // Not valid JSON, ignore
        }
        
        if (tallyEvent?.event === 'Tally.FormSubmitted') {
            await handleTallySubmission(tallyEvent);
        }
    });
    
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            pauseVideo();
        }
    });
}

document.addEventListener('DOMContentLoaded', init);

