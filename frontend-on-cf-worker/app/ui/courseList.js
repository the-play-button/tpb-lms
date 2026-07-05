/**
 * Course List UI Component — the "Mon Parcours" sidebar. Program-aware (Plan 11):
 * courses are grouped under collapsible Program sections (Maker School …), with
 * standalone courses (program_id == null) listed flat below.
 */
import { getState, subscribe } from '../state.js';
import { renderMasteryBadge, getMasteryLevel, injectMasteryStyles } from './masteryBadge.js';
import { safeHtml, raw, setSafeHtml } from './safe-dom.js';

// Collapse state persists across re-renders (progress changes re-render the list).
const collapsedPrograms = new Set();

const renderCourseItem = (course, currentCourse) => {
    const hasProgress = course.progress && course.progress.steps_completed > 0;
    const statusClass = course.progress?.course_completed ? 'completed' : (hasProgress ? 'in-progress' : '');
    const activeClass = course.id === currentCourse ? 'active' : '';
    const masteryBadge = renderMasteryBadge(getMasteryLevel(course.progress?.progress_percent || 0), { size: 'small' });
    return safeHtml`
        <li>
            <a href="#" class="${statusClass} ${activeClass}" data-testid="course-list-item-${course.id}" data-som-id="${course.id}">
                <span class="course-title">${course.title}</span>
                <span class="course-badges">
                    ${raw(masteryBadge)}
                    ${course.progress?.course_completed ? ' ✅' : ''}
                </span>
            </a>
        </li>
    `;
};

// Pure: build the grouped sidebar HTML (program sections + standalone). Exported for
// tests; renderCourseList wires it to the DOM.
export const buildCourseListHtml = (courses, programs, currentCourse, collapsed = collapsedPrograms) => {
    const byProgram = new Map();
    const standalone = [];
    for (const course of courses) {
        if (course.program_id) {
            if (!byProgram.has(course.program_id)) byProgram.set(course.program_id, []);
            byProgram.get(course.program_id).push(course);
        } else {
            standalone.push(course);
        }
    }

    // Program sections (only those that actually have courses), in the programs list order.
    const programSections = programs
        .filter((p) => (byProgram.get(p.id) || []).length > 0)
        .map((p) => {
            const items = byProgram.get(p.id).map((c) => renderCourseItem(c, currentCourse)).join('');
            const collapsedClass = collapsed.has(p.id) ? ' collapsed' : '';
            const expanded = collapsed.has(p.id) ? 'false' : 'true';
            return safeHtml`
                <li class="nav-program${raw(collapsedClass)}" data-program-group="${p.id}">
                    <button type="button" class="nav-program-header" data-program-toggle="${p.id}" aria-expanded="${expanded}">
                        <span class="nav-program-caret">▾</span>
                        <span class="nav-program-name">${p.name}</span>
                        <span class="nav-program-count">${p.course_count}</span>
                    </button>
                    <ul class="nav-sublist">${raw(items)}</ul>
                </li>
            `;
        }).join('');

    const standaloneItems = standalone.map((c) => renderCourseItem(c, currentCourse)).join('');
    return safeHtml`${raw(programSections)}${raw(standaloneItems)}`;
};

export const renderCourseList = () => {
    const list = document.getElementById('somList');
    if (!list) return;
    injectMasteryStyles();
    setSafeHtml(list, buildCourseListHtml(getState('courses') || [], getState('programs') || [], getState('currentCourse')));
};

export const initCourseList = () => {
    subscribe('courses', renderCourseList);
    subscribe('programs', renderCourseList);
    subscribe('currentCourse', renderCourseList);

    // Wire the program-header collapse toggle once (delegated). The a[data-som-id]
    // course click stays handled by eventListeners.js (unchanged).
    const list = document.getElementById('somList');
    if (list && !list.dataset.programToggleWired) {
        list.dataset.programToggleWired = '1';
        list.addEventListener('click', (e) => {
            const header = e.target.closest('[data-program-toggle]');
            if (!header) return;
            e.preventDefault();
            const id = header.dataset.programToggle;
            const section = header.closest('.nav-program');
            if (collapsedPrograms.has(id)) {
                collapsedPrograms.delete(id);
                section?.classList.remove('collapsed');
                header.setAttribute('aria-expanded', 'true');
            } else {
                collapsedPrograms.add(id);
                section?.classList.add('collapsed');
                header.setAttribute('aria-expanded', 'false');
            }
        });
    }
};
