/**
 * Steps Sidebar — in-course lesson & section navigation (Skool-style course rail).
 *
 * Renders `course.nodes[]` as collapsible SECTION folders + LESSON items. Lessons
 * up to the furthest unlocked step are clickable (jump via navigateToStep) ;
 * locked lessons stay non-interactive. Falls back to a flat / tpb_section grouping
 * when the backend has not sent a `nodes` tree.
 */

import { getState, subscribe } from '../state.js';
import { safeHtml, raw, setSafeHtml } from './safe-dom.js';
import { t } from '../../i18n/index.js';

// Collapsed SECTION ids — module-level so full re-renders (on navigation /
// progress) preserve the user's expand/collapse choices.
const collapsedSections = new Set();

const INDENT_BASE_PX = 8;
const INDENT_STEP_PX = 14;
const indentPx = (depth) => INDENT_BASE_PX + depth * INDENT_STEP_PX;

const buildCtx = (course, signals, currentStepIndex) => {
    const completedSteps = new Set(
        (signals?.steps || [])
            .filter(({ step_completed } = {}) => step_completed)
            .map(({ class_id } = {}) => class_id),
    );
    // Reachable ceiling = exactly what navigateToStep() clamps to, so a lesson we
    // mark clickable always actually navigates (no silent clamp). Hyper-linear:
    // only completed + current steps are reachable until the current one is done.
    const maxAccessibleIndex = (signals?.can_access_step ?? 1) - 1;
    return { course, completedSteps, currentStepIndex, maxAccessibleIndex };
};

/**
 * Render the in-course lesson & section tree into #stepsSidebar.
 * @param {Object} options
 * @param {boolean} options.showSections - Group by section (default: true)
 */
export const renderStepsSidebar = (options = {}) => {
    const { showSections = true } = options;
    const sidebar = document.getElementById('stepsSidebar');
    if (!sidebar) return;

    const course = getState('courseData');
    const { classes = [] } = course ?? {};
    if (!classes.length) {
        sidebar.classList.add('is-empty');
        setSafeHtml(sidebar, '');
        return;
    }
    sidebar.classList.remove('is-empty');

    const ctx = buildCtx(course, getState('signals'), getState('currentStepIndex'));
    const widthPercent = `${(ctx.completedSteps.size / classes.length) * 100}%`;

    const fragments = [safeHtml`
        <div class="sidebar-header">
            <button type="button" class="back-to-classroom" data-testid="back-to-classroom">← ${t('nav.allCourses')}</button>
            <h3 class="sidebar-title">${course.title || course.name}</h3>
            <div class="sidebar-progress">
                <span class="progress-text">${ctx.completedSteps.size}/${classes.length}</span>
                <div class="progress-bar-mini">
                    <div class="progress-fill" style="width: ${widthPercent}"></div>
                </div>
            </div>
        </div>
        <nav class="steps-list">
    `];

    if (Array.isArray(course.nodes) && course.nodes.length && showSections) {
        fragments.push(renderNodesTree(course.nodes, ctx, 0));
    } else {
        const grouped = showSections ? groupBySection(classes) : { '': classes };
        for (const [section, steps] of Object.entries(grouped)) {
            if (section && showSections) {
                fragments.push(safeHtml`<div class="section-header static">${section}</div>`);
            }
            for (const step of steps) fragments.push(renderLessonItem(step, ctx, 0));
        }
    }

    fragments.push(`</nav>`);
    setSafeHtml(sidebar, fragments.join(''));
};

/**
 * Render an adjacency-list node tree: collapsible SECTION folders (indented by
 * depth) + LESSON step-items. Returns a safe HTML string.
 */
export const renderNodesTree = (nodes, ctx, depth) => {
    let out = '';
    for (const node of nodes) {
        if (node.node_kind === 'SECTION') {
            const sectionId = node.id || node.name;
            const isCollapsed = collapsedSections.has(sectionId);
            const indent = raw(`style="padding-left:${indentPx(depth)}px"`);
            const groupClass = isCollapsed ? 'section-group collapsed' : 'section-group';
            out += safeHtml`<div class="${groupClass}" data-section-id="${sectionId}">`;
            out += safeHtml`<button type="button" class="section-header" ${indent} aria-expanded="${isCollapsed ? 'false' : 'true'}" aria-label="${t('sidebar.toggleSection')}"><span class="section-chevron">${isCollapsed ? '▸' : '▾'}</span><span class="section-name">${node.name}</span></button>`;
            out += `<div class="section-children">`;
            if (Array.isArray(node.children) && node.children.length) {
                out += renderNodesTree(node.children, ctx, depth + 1);
            }
            out += `</div></div>`;
        } else {
            out += renderLessonItem(node, ctx, depth);
        }
    }
    return out;
};

/**
 * Render one LESSON as a sidebar step-item. `data-step` is the lesson's index in
 * the flat `course.classes` sequence (what the navigation click handler expects).
 * Accessible lessons carry `.clickable` ; locked ones do not (non-interactive).
 */
export const renderLessonItem = (step, ctx, depth) => {
    const { course, completedSteps, currentStepIndex } = ctx;
    const index = course.classes.findIndex(({ id } = {}) => id === step.id);
    const isCompleted = completedSteps.has(step.id);
    const isCurrent = index === currentStepIndex;
    // Reachable iff at/below the ceiling navigateToStep() enforces (progress-gated).
    const ceiling = ctx.maxAccessibleIndex ?? (currentStepIndex ?? 0);
    const isAccessible = index <= ceiling;
    const isLocked = !isAccessible;

    const statusClass = isCurrent ? 'current' : isCompleted ? 'completed' : isLocked ? 'locked' : 'pending';
    const statusIcon = isCurrent ? '▶' : isCompleted ? '✓' : isLocked ? '🔒' : '○';
    const clickable = isAccessible && !isCurrent ? ' clickable' : '';

    const stepType = (step.raw_json ? JSON.parse(step.raw_json) : {}).tpb_step_type || step.step_type || 'CONTENT';
    const typeIcon = getStepTypeIcon(stepType);
    const indent = raw(`style="padding-left:${indentPx(depth)}px"`);

    return safeHtml`
        <div class="step-item ${statusClass}${clickable}" data-step="${index}" ${indent} title="${getStepTooltip(statusClass)}">
            <span class="step-status">${statusIcon}</span>
            <span class="step-name">${step.name}</span>
            <span class="step-type-icon">${typeIcon}</span>
        </div>
    `;
};

/**
 * Wire the sidebar: re-render on course/progress/navigation state changes, and
 * delegate clicks (lesson jump + section collapse toggle).
 */
export const initStepsSidebar = () => {
    // Wrap in arrows: subscribe() passes (value, oldValue) which would land as
    // renderStepsSidebar's `options` (destructuring a null courseData would throw
    // and mark the subscriber broken). renderStepsSidebar reads state itself.
    subscribe('courseData', () => renderStepsSidebar());
    subscribe('signals', () => renderStepsSidebar());
    subscribe('currentStepIndex', () => renderStepsSidebar());

    const sidebar = document.getElementById('stepsSidebar');
    if (!sidebar || sidebar.dataset.wired) return;
    sidebar.dataset.wired = '1';

    sidebar.addEventListener('click', async (event) => {
        if (event.target.closest('.back-to-classroom')) {
            const { renderClassroom } = await import('./classroom.js');
            renderClassroom();
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

const toggleSection = (header) => {
    const group = header.closest('.section-group');
    const sectionId = group?.dataset.sectionId;
    if (!sectionId) return;
    if (collapsedSections.has(sectionId)) collapsedSections.delete(sectionId);
    else collapsedSections.add(sectionId);
    const collapsed = group.classList.toggle('collapsed');
    header.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    const chevron = header.querySelector('.section-chevron');
    if (chevron) chevron.textContent = collapsed ? '▸' : '▾';
};

/**
 * Group flat classes by their legacy `tpb_section` raw_json label (fallback when
 * the backend hasn't sent a `nodes` tree).
 */
const groupBySection = (classes) => {
    const groups = {};
    for (const cls of classes) {
        const section = (cls.raw_json ? JSON.parse(cls.raw_json) : {}).tpb_section || '';
        if (!groups[section]) groups[section] = [];
        groups[section].push(cls);
    }
    return groups;
};

const getStepTypeIcon = (stepType) => {
    switch (stepType) {
        case 'VIDEO': return '🎬';
        case 'QUIZ': return '📝';
        case 'CONTENT': return '📄';
        case 'MIXED': return '📦';
        default: return '📄';
    }
};

const getStepTooltip = (status) => {
    switch (status) {
        case 'current': return t('sidebar.stepCurrent');
        case 'completed': return t('sidebar.stepCompleted');
        case 'locked': return t('sidebar.stepLocked');
        case 'pending': return t('sidebar.stepPending');
        default: return '';
    }
};
