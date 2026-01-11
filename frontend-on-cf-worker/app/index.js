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

// UI Components
import { updateUserStats, initUserStats } from './ui/userStats.js';
import { updateBadgesGrid, initBadges, iconMap } from './ui/badges.js';
import { renderCourseList, initCourseList } from './ui/courseList.js';
import { initUserMenu } from './ui/userMenu.js';
import { renderLangSelector, initLangSelector } from './ui/langSelector.js';

// i18n
import { initLanguage, t, getLanguage } from '../i18n/index.js';

// Course
import { loadCourse } from './course/loader.js';
import { initNavigation } from './course/navigation.js';
import { renderCurrentStep } from './course/renderer.js';

// Video & Quiz
import { stopVideoTracking, pauseVideo, isVideoPlaying } from './video/tracking.js';
import { initQuizHandler, handleTallySubmission } from './quiz/handler.js';

// Other
import { loadLeaderboard } from './leaderboard.js';
import { showBadgeModal, showError, refreshUserData, initNotifications } from './notifications.js';

// Debug
import { initDebugCollector, setUserContext } from './debug/collector.js';
import { initDebugFab } from './debug/fab.js';

// Admin
import { initAdminDashboard } from './admin/dashboard.js';

// KMS
import { initKmsLinks } from './kms/viewer.js';

/**
 * Initialize application
 */
async function init() {
    // Initialize debug collector FIRST (before any API calls)
    initDebugCollector();
    initDebugFab();
    
    try {
        // 1. Get session from API
        const session = await api('/auth/session');
        setState('user', session.user);
        setState('profile', session.profile);
        setState('badges', session.badges || []);
        
        console.log('🔐 Session loaded:', session.user.email);
        
        // Sentry: Set user context for error tracking
        if (window.Sentry) {
            window.Sentry.setUser({
                id: session.profile?.contact_id || session.user.id,
                email: session.user.email
            });
        }
        
        // Debug collector: Set user context
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
        console.error('Failed to initialize:', error);
        showError(error.message);
    }
}

/**
 * Initialize language selector in header
 */
function initLangSelectorInHeader() {
    const userMenu = document.getElementById('userMenu');
    if (!userMenu) return;
    
    // Insert lang selector before user menu
    const langContainer = document.createElement('div');
    langContainer.innerHTML = renderLangSelector();
    userMenu.parentElement.insertBefore(langContainer.firstElementChild, userMenu);
    
    initLangSelector();
}

/**
 * Initialize mobile bottom tab bar navigation
 * Uses dedicated mobile views (not sidebar) for cleaner separation
 */
function initMobileTabs() {
    const mobileTabs = document.getElementById('mobileTabs');
    const content = document.querySelector('.lms-content');
    const parcoursView = document.getElementById('mobileParcoursView');
    const badgesView = document.getElementById('mobileBadgesView');
    
    if (!mobileTabs) return;
    
    // Populate mobile views with current data
    populateMobileCourseList();
    populateMobileBadgesGrid();
    
    mobileTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.mobile-tab');
        if (!tab) return;
        
        const target = tab.dataset.tab;
        
        // Update active tab
        mobileTabs.querySelectorAll('.mobile-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Hide all views first
        content?.classList.remove('mobile-hidden');
        parcoursView?.classList.remove('visible');
        badgesView?.classList.remove('visible');
        
        // Show target view
        switch (target) {
            case 'content':
                // Default: show course content
                break;
                
            case 'parcours':
                // Show course list overlay, hide content
                content?.classList.add('mobile-hidden');
                parcoursView?.classList.add('visible');
                populateMobileCourseList(); // Refresh data
                break;
                
            case 'badges':
                // Show badges overlay, hide content
                content?.classList.add('mobile-hidden');
                badgesView?.classList.add('visible');
                populateMobileBadgesGrid(); // Refresh data
                break;
        }
    });
}

/**
 * Populate mobile course list from state
 */
function populateMobileCourseList() {
    const container = document.getElementById('mobileCourseList');
    if (!container) return;
    
    const courses = getState('courses') || [];
    const currentCourse = getState('currentCourse');
    
    container.innerHTML = courses.map(course => {
        // Progress status (matches courseList.js logic)
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
    
    // Add click handlers
    container.querySelectorAll('.course-item').forEach(item => {
        item.addEventListener('click', () => {
            const courseId = item.dataset.courseId;
            loadCourse(courseId);
            history.pushState({}, '', `?som=${courseId}`);
            
            // Switch back to content tab
            switchToContentTab();
        });
    });
}

/**
 * Populate mobile badges grid from state
 * Tap on badge opens detail modal
 */
function populateMobileBadgesGrid() {
    const container = document.getElementById('mobileBadgesGrid');
    if (!container) return;
    
    const allBadges = getState('allBadges') || [];
    const earnedBadges = getState('badges') || [];
    const earnedIds = new Set(earnedBadges.map(b => b.badge_id || b.id));
    
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
    
    // Add tap hint
    const hintEl = document.querySelector('.mobile-badges-view .badge-hint');
    if (!hintEl) {
        const hint = document.createElement('p');
        hint.className = 'badge-hint';
        hint.textContent = 'Appuie sur un badge pour voir les détails';
        container.parentElement?.appendChild(hint);
    }
    
    // Add click handlers for each badge (uses unified showBadgeModal from notifications.js)
    container.querySelectorAll('.badge-item').forEach(item => {
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
function switchToContentTab() {
    const mobileTabs = document.getElementById('mobileTabs');
    const content = document.querySelector('.lms-content');
    const parcoursView = document.getElementById('mobileParcoursView');
    const badgesView = document.getElementById('mobileBadgesView');
    
    // Hide overlays
    parcoursView?.classList.remove('visible');
    badgesView?.classList.remove('visible');
    content?.classList.remove('mobile-hidden');
    
    // Update tab state
    mobileTabs?.querySelectorAll('.mobile-tab').forEach(t => t.classList.remove('active'));
    mobileTabs?.querySelector('[data-tab="content"]')?.classList.add('active');
}

/**
 * Setup DOM event listeners
 */
function setupEventListeners() {
    // Initialize mobile tabs
    initMobileTabs();
    
    // Course navigation in sidebar
    document.getElementById('somList')?.addEventListener('click', (e) => {
        const link = e.target.closest('a[data-som-id]');
        if (link) {
            e.preventDefault();
            const courseId = link.dataset.somId;
            loadCourse(courseId);
            history.pushState({}, '', `?som=${courseId}`);
        }
    });
    
    // Leaderboard tabs
    document.querySelector('.leaderboard-tabs')?.addEventListener('click', (e) => {
        if (e.target.matches('.tab')) {
            document.querySelectorAll('.leaderboard-tabs .tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            loadLeaderboard();
        }
    });
    
    // XP earned event
    window.addEventListener('lms:xp-earned', (e) => {
        showToast(`+${e.detail.xp} XP`, 'points');
        refreshUserData();
    });
    
    // Badge earned event
    window.addEventListener('lms:badge-earned', (e) => {
        showToast(`Badge débloqué : ${e.detail.name}`, 'achievement');
        showBadgeModal(e.detail);
        refreshUserData();
    });
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        stopVideoTracking();
    });
    
    // Reload courses when language changes (preserve current step position)
    window.addEventListener('languagechange', async (e) => {
        console.log('🌐 Language changed to:', e.detail.lang);
        try {
            // Preserve current step before reloading
            const currentStepIndex = getState('currentStepIndex');
            
            // Reload courses list with new language
            const { courses } = await api(`/courses?lang=${e.detail.lang}`);
            setState('courses', courses);
            
            // Reload current course if one is active
            const currentCourse = getState('currentCourse');
            if (currentCourse) {
                const course = await api(`/courses/${currentCourse}?lang=${e.detail.lang}`);
                setState('courseData', course);
                
                // Restore step position (don't reset to beginning)
                setState('currentStepIndex', currentStepIndex);
                renderCurrentStep();
            }
        } catch (error) {
            console.error('Failed to reload with new language:', error);
        }
    });
    
    // Listen for Tally form submission via postMessage
    window.addEventListener('message', async (event) => {
        // Only process Tally messages (ignore Cloudflare Stream/iFrameResizer noise)
        if (!event.origin.includes('tally.so')) {
            return;
        }
        
        console.log('📨 [TALLY] postMessage:', event.data);
        
        // Tally sends { event: 'Tally.FormSubmitted', payload: {...} }
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
    
    // Pause video when user switches tab/window
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            pauseVideo();
        }
    });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);

