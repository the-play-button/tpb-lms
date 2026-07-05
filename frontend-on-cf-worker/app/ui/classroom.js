/**
 * Classroom — Skool-style landing : a grid of course cards. Clicking a card opens
 * the course overview (description + section/lesson outline + Start/Continue CTA).
 */
import { api } from '../api.js';
import { getState, setState, subscribe } from '../state.js';
import { log } from '../log.js';
import { setSafeHtml, safeHtml, raw } from './safe-dom.js';
import { t } from '../../i18n/index.js';

// Deterministic gradient cover derived from the course id (no external image dep).
const coverGradient = (courseId) => {
    let hue = 0;
    for (let i = 0; i < courseId.length; i += 1) hue = (hue * 31 + courseId.charCodeAt(i)) % 360;
    return `linear-gradient(135deg, hsl(${hue} 55% 34%), hsl(${(hue + 45) % 360} 50% 20%))`;
};

// The /courses list only carries { videos_completed, quizzes_passed } (no total),
// so accurate % + completion come from each course's /signals course_progress.
// Real course cover (media IMAGE url) when present, else the deterministic gradient.
// A dark scrim keeps the ▶ + focus ring readable over bright cover images.
const coverStyle = (course) => {
    const url = course.cover_image_url;
    if (url) {
        const scrim = 'linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.55))';
        return `background-image: ${scrim}, url("${encodeURI(url)}"); background-size: cover; background-position: center;`;
    }
    return `background: ${coverGradient(course.id)};`;
};

export const renderCard = (course, courseProgress = null) => {
    const percent = courseProgress?.percent ?? 0;
    const completed = !!courseProgress && courseProgress.total > 0 && courseProgress.completed >= courseProgress.total;
    const cta = completed ? t('course.review') : percent > 0 ? t('course.continue') : t('course.start');
    return safeHtml`
        <button type="button" class="course-card" data-course="${course.id}" data-testid="classroom-card-${course.id}">
            <span class="course-card-cover" style="${raw(coverStyle(course))}">
                <span class="course-card-play">▶</span>
            </span>
            <span class="course-card-body">
                <span class="course-card-title">${course.title || course.name}</span>
                ${course.description ? raw(safeHtml`<span class="course-card-desc">${course.description}</span>`) : ''}
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
 * (clears courseData so the lesson tree collapses to empty). Per-course progress
 * is fetched from /signals so the cards show real completion (Skool-style).
 */
export const renderClassroom = async () => {
    const viewer = document.getElementById('somViewer');
    if (!viewer) return;

    setState('currentCourse', null);
    setState('courseData', null);

    const courses = getState('courses') || [];
    setSafeHtml(viewer, safeHtml`
        <div class="classroom">
            <h1 class="classroom-title">${t('classroom.title')}</h1>
            <div class="course-grid loading"><div class="loading-spinner"></div></div>
        </div>
    `);

    const progressById = {};
    await Promise.all(courses.map(async (course) => {
        try {
            const signals = await api(`/signals/${course.id}`);
            progressById[course.id] = signals.course_progress ?? null;
        } catch (error) {
            // Non-blocking: a broken signal endpoint shouldn't hide the card. Log
            // it (§ ALWAYS FAIL HARD) and render the card at 0%.
            log.warn(`classroom: signals fetch failed for ${course.id}`, error);
            progressById[course.id] = null;
        }
    }));

    // Guard against a navigation away while progress was loading.
    if (getState('currentCourse') || !document.querySelector('.classroom')) return;

    const cards = courses.map((course) => renderCard(course, progressById[course.id])).join('');
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
