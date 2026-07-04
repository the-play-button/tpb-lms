/**
 * UI orchestration — aggregates per-component init + initial render.
 *
 * Extracted from bootSequence.js to reduce coupling : bootSequence imports
 * ONE UI module instead of N.
 */
import { updateUserStats, initUserStats } from './userStats.js';
import { updateBadgesGrid, initBadges } from './badges.js';
import { renderCourseList, initCourseList } from './courseList.js';
import { initStepsSidebar } from './stepsSidebar.js';
import { initClassroom } from './classroom.js';
import { initUserMenu } from './userMenu.js';
import { setState } from '../state.js';
import { renderLangSelector, initLangSelector } from './langSelector.js';
import { setSafeHtml } from './safe-dom.js';

const initLangSelectorInHeader = () => {
    const userMenu = document.getElementById('userMenu');
    if (!userMenu) return;

    const langContainer = document.createElement('div');
    setSafeHtml(langContainer, renderLangSelector());
    userMenu.parentElement.insertBefore(langContainer.firstElementChild, userMenu);

    initLangSelector();
};

/**
 * Subscribe + initial-render all UI components.
 * @param {{ user: object, profile: object }} session
 */
export const initAllUI = (session) => {
    // Keep the session so language-change can re-render the user menu (§ i18n).
    setState('session', session);

    // Subscriptions (reactive UI)
    initUserStats();
    initBadges();
    initCourseList();
    initStepsSidebar();
    initClassroom();

    // Initial render
    updateUserStats();
    renderCourseList();
    updateBadgesGrid();

    // User menu (logout button)
    initUserMenu(session.user, session.profile);

    // Language selector in header
    initLangSelectorInHeader();
};
