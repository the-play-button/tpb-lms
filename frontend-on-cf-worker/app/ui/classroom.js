/**
 * Classroom — Skool-style landing : a grid of course cards. Clicking a card opens
 * the course overview (description + section/lesson outline + Start/Continue CTA).
 */
import { getState, setState, subscribe } from '../state.js';
import { setSafeHtml, safeHtml, raw } from './safe-dom.js';
import { t } from '../../i18n/index.js';

// Deterministic gradient cover derived from the course id (no external image dep).
const coverGradient = (courseId) => {
    let hue = 0;
    for (let i = 0; i < courseId.length; i += 1) hue = (hue * 31 + courseId.charCodeAt(i)) % 360;
    return `linear-gradient(135deg, hsl(${hue} 55% 34%), hsl(${(hue + 45) % 360} 50% 20%))`;
};

export const renderCard = (course) => {
    const percent = course.progress?.progress_percent || 0;
    const completed = course.progress?.course_completed;
    const cta = completed ? t('course.review') : percent > 0 ? t('course.continue') : t('course.start');
    return safeHtml`
        <button type="button" class="course-card" data-course="${course.id}" data-testid="classroom-card-${course.id}">
            <span class="course-card-cover" style="background: ${raw(coverGradient(course.id))}">
                <span class="course-card-play">▶</span>
            </span>
            <span class="course-card-body">
                <span class="course-card-title">${course.title || course.name}</span>
                ${course.description ? safeHtml`<span class="course-card-desc">${course.description}</span>` : ''}
                <span class="course-card-progress">
                    <span class="course-card-progress-bar"><span class="course-card-progress-fill" style="width: ${percent}%"></span></span>
                    <span class="course-card-progress-text">${percent}%</span>
                </span>
                <span class="course-card-cta">${cta} →</span>
            </span>
        </button>
    `;
};

/**
 * Render the classroom grid into #somViewer and leave the in-course context
 * (clears courseData so the lesson tree collapses to empty).
 */
export const renderClassroom = () => {
    const viewer = document.getElementById('somViewer');
    if (!viewer) return;

    setState('currentCourse', null);
    setState('courseData', null);

    const courses = getState('courses') || [];
    const cards = courses.map(renderCard).join('');
    setSafeHtml(viewer, safeHtml`
        <div class="classroom">
            <h1 class="classroom-title">${t('classroom.title')}</h1>
            <div class="course-grid">${raw(cards)}</div>
        </div>
    `);

    const params = new URLSearchParams(window.location.search);
    params.delete('som');
    params.delete('course');
    params.delete('step');
    const qs = params.toString();
    history.pushState({}, '', qs ? `?${qs}` : window.location.pathname);
};

export const initClassroom = () => {
    // Refresh the grid on courses change only while the classroom is showing.
    subscribe('courses', () => {
        if (!getState('currentCourse') && document.querySelector('.classroom')) renderClassroom();
    });

    const viewer = document.getElementById('somViewer');
    if (!viewer || viewer.dataset.classroomWired) return;
    viewer.dataset.classroomWired = '1';

    viewer.addEventListener('click', async (event) => {
        const card = event.target.closest('.course-card[data-course]');
        if (!card) return;
        const { showCourseOverview } = await import('../course/overview.js');
        await showCourseOverview(card.dataset.course);
    });
};
