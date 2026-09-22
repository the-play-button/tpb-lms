/**
 * Setup DOM event listeners (extracted from app/index.js to reduce coupling).
 */
import { setState, getState } from '../state.js';
import { api } from '../api.js';
import { log } from '../log.js';

import { renderCurrentStep } from '../course/renderer.js';
import { t } from '../../i18n/index.js';
import { stopVideoTracking, pauseVideo } from '../video/tracking/index.js';
import { handleTallySubmission } from '../quiz/handler.js';
import { loadLeaderboard } from '../leaderboard.js';
import { showBadgeModal, refreshUserData } from '../notifications.js';
import { initMobileTabs } from '../ui/mobileTabs.js';
import { initUserMenu } from '../ui/userMenu.js';
import { updateBadgesGrid } from '../ui/badges.js';
import { copyTextToClipboard } from '../ui/clipboard.js';

export const setupEventListeners = () => {
    initMobileTabs();

    // SINGLE AUTHORITY for the transcript copy action: one delegated listener on the stable
    // step container (#somViewer persists across renders — only its innerHTML changes). It reads
    // the transcript from state (SSOT), so no per-render wiring and no huge text in the DOM.
    // preventDefault stops the click from toggling the <details> open.
    document.getElementById('somViewer')?.addEventListener('click', async (e) => {
        const btn = e.target.closest('.transcript-copy');
        if (!btn) return;
        e.preventDefault();
        const cls = getState('courseData')?.classes?.[getState('currentStepIndex')];
        const ok = await copyTextToClipboard(cls?.transcript_md);
        const restore = btn.dataset.label || btn.textContent;
        btn.dataset.label = restore;
        btn.textContent = ok ? t('course.copied') : t('course.copyFailed');
        btn.classList.toggle('copied', ok);
        clearTimeout(btn._t);
        btn._t = setTimeout(() => { btn.textContent = restore; btn.classList.remove('copied'); }, 1500);
    });

    // The left-rail course tree (#courseTree) is wired in app/ui/sidebar.js
    // (program picker + course open + lesson navigation). Nothing to do here.

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
        showToast(t('badge.earnedToast', { name: e.detail.name }), 'achievement');
        showBadgeModal(e.detail);
        refreshUserData();
    });

    window.addEventListener('beforeunload', () => {
        stopVideoTracking();
    });

    window.addEventListener('languagechange', async (e) => {
        log.debug('🌐 Language changed to:', e.detail.lang);
        try {
            // Re-render the static header chrome (not state-subscribed) in the new
            // language: user menu + badges grid + leaderboard.
            const session = getState('session');
            if (session) initUserMenu(session.user, session.profile);
            updateBadgesGrid();
            loadLeaderboard();

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
            setState('languageReloadFailed', true); // explicit recovery — UI can show "retry" prompt
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
};
