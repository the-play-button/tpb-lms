/**
 * Sidebar — ONE program-scoped tree for the whole left rail (`#courseTree`).
 *
 * Mirrors the content scope 1:1 so the rail is never a competing second nav:
 *   - Root (no program, no course)      → program picker: each program + standalone
 *                                          courses as single rows (click → enter).
 *   - Program active (program or course) → ONLY that program's courses. The open
 *                                          course expands inline to its lesson tree
 *                                          (from stepsSidebar), current lesson = ▶.
 *   - Standalone course open             → back + that course's lessons alone.
 *
 * Replaces the old stacked pair (#stepsSidebar lesson tree + #somList all-programs
 * list). Lesson rendering is reused from stepsSidebar.js (single source of truth).
 */

import { getState, subscribe } from '../state.js';
import { safeHtml, raw, setSafeHtml } from './safe-dom.js';
import { t } from '../../i18n/index.js';
import { renderMasteryBadge, getMasteryLevel, injectMasteryStyles } from './masteryBadge.js';
import { buildLessonCtx, renderCourseLessons, toggleSection } from './stepsSidebar.js';

const SUBSCRIBED_KEYS = ['programs', 'courses', 'currentProgram', 'currentCourse', 'courseData', 'signals', 'currentStepIndex'];

const courseBadges = (course) => {
    const mastery = renderMasteryBadge(getMasteryLevel(course.progress?.progress_percent || 0), { size: 'small' });
    const done = course.progress?.course_completed ? ' ✅' : '';
    return `${mastery}${done}`;
};

/** A collapsed course row (click → open that course). */
const renderCourseRow = (course, currentCourse) => {
    const active = course.id === currentCourse ? ' active' : '';
    return safeHtml`
        <li class="tree-course">
            <button type="button" class="tree-course-row${raw(active)}" data-open-course="${course.id}" data-testid="tree-course-${course.id}">
                <span class="tree-caret">▸</span>
                <span class="tree-label">${course.title || course.name}</span>
                <span class="tree-badges">${raw(courseBadges(course))}</span>
            </button>
        </li>
    `;
};

/** A course node in a program tree: expanded (with lessons) when it is the open course. */
const renderCourseNode = (course, { currentCourse, courseData, signals, currentStepIndex }) => {
    if (course.id !== currentCourse) return renderCourseRow(course, currentCourse);
    const ctx = buildLessonCtx(courseData, signals, currentStepIndex);
    return safeHtml`
        <li class="tree-course expanded">
            <button type="button" class="tree-course-row current" data-open-course="${course.id}">
                <span class="tree-caret">▾</span>
                <span class="tree-label">${course.title || course.name}</span>
                <span class="tree-badges">${raw(courseBadges(course))}</span>
            </button>
            ${raw(renderCourseLessons(courseData || {}, ctx))}
        </li>
    `;
};

/**
 * Pure: build the whole `#courseTree` HTML for the given scope. Exported for tests.
 */
export const buildSidebarTreeHtml = ({
    programs = [], courses = [], currentProgram = null,
    currentCourse = null, courseData = null, signals = null, currentStepIndex = 0,
} = {}) => {
    const currentCourseObj = currentCourse ? courses.find((c) => c.id === currentCourse) : null;
    const scopedProgramId = currentProgram ?? currentCourseObj?.program_id ?? null;

    // --- A program is in scope (program landing OR a course within a program) ---
    if (scopedProgramId) {
        const program = programs.find((p) => p.id === scopedProgramId);
        const programCourses = courses.filter((c) => c.program_id === scopedProgramId);
        const title = program?.name || currentCourseObj?.title || '';
        const nodes = programCourses
            .map((c) => renderCourseNode(c, { currentCourse, courseData, signals, currentStepIndex }))
            .join('');
        return safeHtml`
            <button type="button" class="tree-back" data-back-to-classroom data-testid="tree-back">← ${t('nav.allPrograms')}</button>
            <button type="button" class="tree-program-title" data-open-program="${scopedProgramId}" data-testid="tree-program-title">${title}</button>
            <ul class="tree-list">${raw(nodes)}</ul>
        `;
    }

    // --- A standalone course is open (no program) ---
    if (currentCourseObj) {
        const ctx = buildLessonCtx(courseData, signals, currentStepIndex);
        return safeHtml`
            <button type="button" class="tree-back" data-back-to-classroom data-testid="tree-back">← ${t('nav.allPrograms')}</button>
            <button type="button" class="tree-program-title" data-open-course="${currentCourseObj.id}">${courseData?.title || currentCourseObj.title}</button>
            ${raw(renderCourseLessons(courseData || {}, ctx))}
        `;
    }

    // --- Root: program picker (programs that have courses + standalone courses) ---
    const programRows = programs
        .filter((p) => (p.course_count ?? courses.filter((c) => c.program_id === p.id).length) > 0)
        .map((p) => safeHtml`
            <li class="tree-program">
                <button type="button" class="tree-program-row" data-open-program="${p.id}" data-testid="tree-program-${p.id}">
                    <span class="tree-caret">▸</span>
                    <span class="tree-label">${p.name}</span>
                    <span class="tree-count">${p.course_count}</span>
                </button>
            </li>
        `).join('');
    const standaloneRows = courses.filter((c) => !c.program_id).map((c) => renderCourseRow(c, currentCourse)).join('');
    return safeHtml`
        <div class="tree-eyebrow">${t('sidebar.programs')}</div>
        <ul class="tree-list">${raw(programRows)}${raw(standaloneRows)}</ul>
    `;
};

export const renderSidebarTree = () => {
    const el = document.getElementById('courseTree');
    if (!el) return;
    injectMasteryStyles();
    setSafeHtml(el, buildSidebarTreeHtml({
        programs: getState('programs') || [],
        courses: getState('courses') || [],
        currentProgram: getState('currentProgram'),
        currentCourse: getState('currentCourse'),
        courseData: getState('courseData'),
        signals: getState('signals'),
        currentStepIndex: getState('currentStepIndex'),
    }));
};

export const initSidebar = () => {
    SUBSCRIBED_KEYS.forEach((key) => subscribe(key, renderSidebarTree));

    const el = document.getElementById('courseTree');
    if (!el || el.dataset.wired) return;
    el.dataset.wired = '1';

    el.addEventListener('click', async (event) => {
        if (event.target.closest('[data-back-to-classroom]')) {
            const { renderClassroom } = await import('./classroom.js');
            await renderClassroom();
            return;
        }
        const program = event.target.closest('[data-open-program]');
        if (program) {
            const { renderProgram } = await import('./classroom.js');
            await renderProgram(program.dataset.openProgram);
            return;
        }
        const course = event.target.closest('[data-open-course]');
        if (course) {
            // Land on the course overview (same as clicking a course card), not straight
            // into the first lesson. "Commencer" on the overview opens the lesson.
            const { showCourseOverview } = await import('../course/overview.js');
            await showCourseOverview(course.dataset.openCourse);
            return;
        }
        const header = event.target.closest('.section-header');
        if (header && !header.classList.contains('static')) {
            toggleSection(header);
            return;
        }
        const item = event.target.closest('.step-item.clickable');
        if (!item) return;
        const step = Number(item.dataset.step);
        if (!Number.isInteger(step)) return;
        const { navigateToStep } = await import('../course/navigation.js');
        navigateToStep(step);
    });
};
