/**
 * Mobile tabs UI — content / parcours / badges 3-pane mobile view.
 *
 * Extracted from app/index.js to reduce app/index.js coupling (§ high_coupling).
 */
import { getState } from '../state.js';
import { loadCourse } from '../course/loader.js';
import { iconMap } from './badges.js';
import { showBadgeModal } from '../notifications.js';
import { setSafeHtml, safeHtml } from './safe-dom.js';
import { t } from '../../i18n/index.js';

/**
 * Populate mobile course list from state
 */
const populateMobileCourseList = () => {
    const container = document.getElementById('mobileCourseList');
    if (!container) return;

    const courses = getState('courses') || [];
    const currentCourse = getState('currentCourse');

    setSafeHtml(container, courses.map(course => {
        const isCompleted = course.progress?.course_completed;
        const stepsCompleted = course.progress?.steps_completed || 0;
        const isCurrentCourse = course.id === currentCourse;
        let statusText;
        if (isCompleted) {
            statusText = `✅ ${t('mobile.done')}`;
        } else if (isCurrentCourse) {
            statusText = `▶️ ${t('mobile.inProgress')}`;
        } else if (stepsCompleted > 0) {
            statusText = t('course.stepsCount', { n: stepsCompleted });
        } else {
            statusText = t('mobile.notStarted');
        }

        return safeHtml`
            <div class="course-item ${isCurrentCourse ? 'active' : ''}"
                 data-course-id="${course.id}">
                <div class="course-name">${course.title || course.name}</div>
                <div class="course-progress">${statusText}</div>
            </div>
        `;
    }).join(''));

    // Event delegation : single listener on container handles every row click.
    // Replaces per-row addEventListener inside forEach (= entropy
    // `event_listeners` anti-pattern + duplicate-listener risk on re-populate).
    container.onclick = (event) => {
        const item = event.target.closest('.course-item');
        if (!item || !container.contains(item)) return;
        const courseId = item.dataset.courseId;
        loadCourse(courseId);
        history.pushState({}, '', `?som=${courseId}`);
        switchToContentTab();
    };
};

/**
 * Populate mobile badges grid from state
 * Tap on badge opens detail modal
 */
const populateMobileBadgesGrid = () => {
    const container = document.getElementById('mobileBadgesGrid');
    if (!container) return;

    const allBadges = getState('allBadges') || [];
    const earnedBadges = getState('badges') || [];
    const earnedIds = new Set(earnedBadges.map(({ badge_id, id } = {}) => badge_id || id));

    setSafeHtml(container, allBadges.map((badge, index) => {
        const isEarned = earnedIds.has(badge.id);
        const icon = iconMap[badge.id] || '🏆';
        return safeHtml`
            <div class="badge-item ${isEarned ? 'earned' : 'locked'}"
                 data-badge-index="${index}">
                <span class="badge-icon">${icon}</span>
                <span class="badge-name">${badge.name}</span>
            </div>
        `;
    }).join(''));

    const hintEl = document.querySelector('.mobile-badges-view .badge-hint');
    if (!hintEl) {
        const hint = document.createElement('p');
        hint.className = 'badge-hint';
        hint.textContent = t('mobile.badgeHint');
        container.parentElement?.appendChild(hint);
    }

    // Event delegation : single listener on container handles every badge tap.
    container.onclick = (event) => {
        const item = event.target.closest('.badge-item');
        if (!item || !container.contains(item)) return;
        const badge = allBadges[parseInt(item.dataset.badgeIndex, 10)];
        if (badge) {
            showBadgeModal(badge, { isEarned: earnedIds.has(badge.id) });
        }
    };
};

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
};

export const initMobileTabs = () => {
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
