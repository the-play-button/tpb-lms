/**
 * Mobile tabs UI — content / parcours / badges 3-pane mobile view.
 *
 * Extracted from app/index.js to reduce app/index.js coupling (§ high_coupling).
 */
import { getState } from '../state.js';
import { loadCourse } from '../course/loader.js';
import { iconMap } from './badges.js';
import { showBadgeModal } from '../notifications.js';

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

    container.querySelectorAll('.course-item').forEach(item => {
        item.addEventListener('click', () => {
            const courseId = item.dataset.courseId;
            loadCourse(courseId);
            history.pushState({}, '', `?som=${courseId}`);
            switchToContentTab();
        });
    });
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

    container.innerHTML = allBadges.map((badge, index) => {
        const isEarned = earnedIds.has(badge.id);
        const icon = iconMap[badge.id] || '🏆';
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

    container.querySelectorAll('.badge-item').forEach(item => {
        item.addEventListener('click', () => {
            const badge = allBadges[parseInt(item.dataset.badgeIndex, 10)];
            if (badge) {
                showBadgeModal(badge, { isEarned: earnedIds.has(badge.id) });
            }
        });
    });
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
