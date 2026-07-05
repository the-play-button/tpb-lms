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
        // Single quotes inside the url: the whole style lands in a double-quoted
        // style="…" attribute, so url("…") would close the attribute early.
        const scrim = 'linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.55))';
        return `background-image: ${scrim}, url('${encodeURI(url)}'); background-size: cover; background-position: center;`;
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

// A Program card (grouping of courses, Plan 10) — same cover treatment as a course
// card, but the footer shows the course count instead of a progress bar.
export const renderProgramCard = (program) => safeHtml`
    <button type="button" class="course-card program-card" data-program="${program.id}" data-testid="classroom-program-${program.id}">
        <span class="course-card-cover" style="${raw(coverStyle(program))}">
            <span class="course-card-play">▶</span>
        </span>
        <span class="course-card-body">
            <span class="course-card-title">${program.name}</span>
            ${program.description ? raw(safeHtml`<span class="course-card-desc">${program.description}</span>`) : ''}
            <span class="course-card-cta">${program.course_count} ${t('classroom.courses')} →</span>
        </span>
    </button>
`;

// Per-course completion from /signals (non-blocking — a broken endpoint renders 0%).
const fetchProgress = async (courses) => {
    const progressById = {};
    await Promise.all(courses.map(async (course) => {
        try {
            const signals = await api(`/signals/${course.id}`);
            progressById[course.id] = signals.course_progress ?? null;
        } catch (error) {
            log.warn(`classroom: signals fetch failed for ${course.id}`, error);
            progressById[course.id] = null;
        }
    }));
    return progressById;
};

/**
 * Root classroom (Plan 10): Program cards (Maker School …) + standalone courses
 * (program_id == null) at the top level. Clicking a program drills into its courses.
 */
export const renderClassroom = async () => {
    const viewer = document.getElementById('somViewer');
    if (!viewer) return;

    setState('currentProgram', null);
    setState('currentCourse', null);
    setState('courseData', null);

    const programs = getState('programs') || [];
    const standalone = (getState('courses') || []).filter((c) => !c.program_id);

    setSafeHtml(viewer, safeHtml`
        <div class="classroom">
            <h1 class="classroom-title">${t('classroom.title')}</h1>
            <div class="course-grid loading"><div class="loading-spinner"></div></div>
        </div>
    `);

    const progressById = await fetchProgress(standalone);

    // Guard against a navigation away while progress was loading.
    if (getState('currentCourse') || !document.querySelector('.classroom')) return;

    const cards = programs.map(renderProgramCard).join('')
        + standalone.map((course) => renderCard(course, progressById[course.id])).join('');
    setSafeHtml(viewer, safeHtml`
        <div class="classroom">
            <h1 class="classroom-title">${t('classroom.title')}</h1>
            <div class="course-grid">${raw(cards)}</div>
        </div>
    `);

    const params = new URLSearchParams(window.location.search);
    ['som', 'course', 'step', 'program'].forEach((p) => params.delete(p));
    const qs = params.toString();
    history.pushState({}, '', qs ? `?${qs}` : window.location.pathname);
};

/** Program landing (Plan 10): the courses of one program + a back link to the root. */
export const renderProgram = async (programId) => {
    const viewer = document.getElementById('somViewer');
    if (!viewer) return;

    setState('currentProgram', programId);
    setState('currentCourse', null);
    setState('courseData', null);

    const program = (getState('programs') || []).find((p) => p.id === programId);
    if (!program) return renderClassroom();
    const courses = (getState('courses') || []).filter((c) => c.program_id === programId);

    setSafeHtml(viewer, safeHtml`
        <div class="classroom classroom-program">
            <button type="button" class="classroom-back" data-back>← ${t('classroom.title')}</button>
            <h1 class="classroom-title">${program.name}</h1>
            <div class="course-grid loading"><div class="loading-spinner"></div></div>
        </div>
    `);

    const progressById = await fetchProgress(courses);
    if (getState('currentCourse') || !document.querySelector('.classroom-program')) return;

    const cards = courses.map((course) => renderCard(course, progressById[course.id])).join('');
    setSafeHtml(viewer, safeHtml`
        <div class="classroom classroom-program">
            <button type="button" class="classroom-back" data-back>← ${t('classroom.title')}</button>
            <h1 class="classroom-title">${program.name}</h1>
            <div class="course-grid">${raw(cards)}</div>
        </div>
    `);

    const params = new URLSearchParams(window.location.search);
    ['som', 'course', 'step'].forEach((p) => params.delete(p));
    params.set('program', programId);
    history.pushState({}, '', `?${params.toString()}`);
};

export const initClassroom = () => {
    // Re-render the root grid when courses or programs change while it's showing.
    const refreshIfRoot = () => {
        if (!getState('currentCourse') && document.querySelector('.classroom') && !document.querySelector('.classroom-program')) {
            renderClassroom();
        }
    };
    subscribe('courses', refreshIfRoot);
    subscribe('programs', refreshIfRoot);

    const viewer = document.getElementById('somViewer');
    if (!viewer || viewer.dataset.classroomWired) return;
    viewer.dataset.classroomWired = '1';

    viewer.addEventListener('click', async (event) => {
        if (event.target.closest('.classroom-back[data-back]')) {
            await renderClassroom();
            return;
        }
        const programCard = event.target.closest('.program-card[data-program]');
        if (programCard) {
            await renderProgram(programCard.dataset.program);
            return;
        }
        const card = event.target.closest('.course-card[data-course]');
        if (!card) return;
        const { showCourseOverview } = await import('../course/overview.js');
        await showCourseOverview(card.dataset.course);
    });
};
