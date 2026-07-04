/**
 * Course Overview
 * 
 * Displays course introduction/overview before starting.
 * Fetches intro content from tpb_intro_url in course.raw.
 */

import { api, apiPost, apiPatch } from '../api.js';
import { getState, setState } from '../state.js';
import { log } from '../log.js';
import { fetchMarkdown, fetchCloudContent } from '../content/loader/index.js';
import { stripFrontmatter, cleanMarkdownForLms } from '../content/loader/_shared.js';
import { loadCourse } from './loader.js';
import { setSafeHtml, safeHtml, raw } from '../ui/safe-dom.js';
import { t, getLanguage } from '../../i18n/index.js';

/**
 * Read-only section/lesson outline for the overview (curriculum preview). Uses the
 * SECTION → LESSON tree when present, else the flat lesson list.
 */
const renderCourseOutline = (course) => {
    const renderNodes = (list) => list.map((node) => {
        if (node.node_kind === 'SECTION') {
            return safeHtml`<li class="outline-section"><span class="outline-section-name">${node.name}</span><ul class="outline-lessons">${raw(renderNodes(node.children || []))}</ul></li>`;
        }
        return safeHtml`<li class="outline-lesson">${node.name}</li>`;
    }).join('');

    const nodes = Array.isArray(course.nodes) && course.nodes.length ? course.nodes : null;
    const inner = nodes
        ? renderNodes(nodes)
        : (course.classes || []).map((c) => safeHtml`<li class="outline-lesson">${c.name}</li>`).join('');
    if (!inner) return '';
    return safeHtml`
        <section class="course-outline-wrap">
            <h2 class="course-outline-title">${t('course.curriculum')}</h2>
            <ul class="course-outline">${raw(inner)}</ul>
        </section>
    `;
};

/**
 * Render course overview screen
 * @param {Object} course - Course data
 * @param {Object} enrollmentStatus - Enrollment status
 */
export const renderCourseOverview = async (course, enrollmentStatus = null) => {
    const viewer = document.getElementById('somViewer');
    if (!viewer) return;
    
    setSafeHtml(viewer, safeHtml`
        <div class="course-overview loading">
            <div class="loading-spinner"></div>
            <p>${t('course.loadingCourse')}</p>
        </div>
    `);
    
    try {
        const courseRaw = course.raw ? JSON.parse(course.raw) : {};
        const introUrl = courseRaw.tpb_intro_url;
        const introRefId = courseRaw.tpb_intro_ref_id;

        let introContent = '';
        if (introRefId) {
            try {
                const rawMd = await fetchCloudContent(introRefId);
                introContent = marked.parse(cleanMarkdownForLms(stripFrontmatter(rawMd)));
            } catch (error) {
                log.warn('Failed to fetch cloud intro:', error);
                introContent = safeHtml`<p>${course.description || t('course.noDescription')}</p>`;
            }
        } else if (introUrl) {
            try {
                const markdown = await fetchMarkdown(introUrl);
                introContent = marked.parse(markdown);
            } catch (error) {
                log.warn('Failed to fetch intro:', error);
                introContent = safeHtml`<p>${course.description || t('course.noDescription')}</p>`;
            }
        } else {
            introContent = safeHtml`<p>${course.description || t('course.noDescription')}</p>`;
        }
        
        const isEnrolled = enrollmentStatus?.enrolled && enrollmentStatus.enrollment?.status === 'active';
        const canEnroll = enrollmentStatus?.can_enroll ?? true;
        
        const categoriesHtml = course.categories?.length
            ? safeHtml`<div class="course-categories">${raw(course.categories.map((cat) => safeHtml`<span class="category-tag">${cat}</span>`).join(''))}</div>`
            : '';
        const progressHtml = course.progress
            ? safeHtml`<div class="meta-item"><span class="meta-icon">📊</span><span class="meta-text">${t('course.progressCount', { done: course.progress.completed_steps, total: course.progress.total_steps })}</span></div>`
            : '';
        const enrollmentWarningHtml = !canEnroll && !isEnrolled
            ? safeHtml`<div class="enrollment-limit-warning"><span class="warning-icon">⚠️</span><p>${t('course.enrollLimit', { max: enrollmentStatus?.max_active || 3 })}</p></div>`
            : '';

        setSafeHtml(viewer, safeHtml`
            <div class="course-overview">
                <header class="overview-header">
                    <h1 class="course-title">${course.title || course.name}</h1>
                    ${raw(categoriesHtml)}
                </header>

                <div class="overview-content markdown-body">
                    ${raw(introContent)}
                </div>

                <div class="course-meta">
                    <div class="meta-item">
                        <span class="meta-icon">📚</span>
                        <span class="meta-text">${t('course.stepsCount', { n: course.classes?.length || 0 })}</span>
                    </div>
                    ${raw(progressHtml)}
                </div>

                ${raw(renderCourseOutline(course))}

                <div class="overview-actions">
                    ${raw(renderPrimaryCta(course))}
                    ${raw(renderEnrollmentSecondary(course, isEnrolled, canEnroll))}
                </div>

                ${raw(enrollmentWarningHtml)}
            </div>
        `);
        
        setupOverviewHandlers(course.id);
        
    } catch (error) {
        log.error('Failed to render overview:', error);
        setSafeHtml(viewer, safeHtml`
            <div class="course-overview error">
                <h2>${t('errors.title')}</h2>
                <p>${t('course.loadError', { msg: error.message })}</p>
                <button class="btn-primary" data-testid="overview-reload-btn" onclick="window.location.reload()">${t('course.retry')}</button>
            </div>
        `);
    }
};

/**
 * Primary CTA — driven by real progress (not enrollment, which gates nothing).
 * Always opens the course (loadCourse works regardless of enrollment).
 */
export const renderPrimaryCta = (course) => {
    const { completed_steps = 0, total_steps = 0 } = course.progress ?? {};
    const pct = total_steps > 0 ? Math.round((completed_steps / total_steps) * 100) : 0;
    const label = total_steps > 0 && completed_steps >= total_steps
        ? t('course.review')
        : completed_steps > 0
            ? `${t('course.continue')} (${pct}%)`
            : t('course.start');
    return safeHtml`
        <button class="btn-primary btn-start" data-testid="course-open-btn" data-action="open" data-course="${course.id}">
            ${label} →
        </button>
    `;
};

/**
 * Secondary enrollment action — optional "my active courses" curation (cap-limited).
 * Never the primary CTA (§ Plan 10 : enrollment is decoupled from access).
 */
const renderEnrollmentSecondary = (course, isEnrolled, canEnroll) => {
    if (isEnrolled) {
        return safeHtml`
            <button class="btn-secondary btn-abandon" data-testid="course-abandon-btn" data-action="abandon" data-course="${course.id}">
                ${t('course.removeFromActive')}
            </button>
        `;
    }
    if (canEnroll) {
        return safeHtml`
            <button class="btn-secondary btn-enroll" data-testid="course-enroll-btn" data-action="enroll" data-course="${course.id}">
                ${t('course.addToActive')}
            </button>
        `;
    }
    return ''; // at the active-courses cap → the limit warning is shown separately
};

/**
 * Setup click handlers for overview buttons
 */
const setupOverviewHandlers = (courseId) => {
    // Primary CTA : open the course (works regardless of enrollment).
    document.querySelector('[data-action="open"]')?.addEventListener('click', async () => {
        await loadCourse(courseId);
    });

    // Secondary : add to "my active courses" (optional curation). Does NOT force
    // loadCourse — the primary CTA owns that. Refresh the overview to reflect state.
    document.querySelector('[data-action="enroll"]')?.addEventListener('click', async (e) => {
        const btn = e.target;
        btn.disabled = true;
        btn.textContent = t('course.enrolling');

        try {
            await apiPost('/enrollments', { courseId });
            await showCourseOverview(courseId);
        } catch (error) {
            log.error('Enrollment failed:', error);
            btn.disabled = false;
            btn.textContent = t('course.errorRetry');
            alert(t('course.genericError', { msg: error.message }));
        }
    });

    document.querySelector('[data-action="abandon"]')?.addEventListener('click', async (e) => {
        if (!confirm(t('course.abandonConfirm'))) {
            return;
        }

        const btn = e.target;
        btn.disabled = true;
        btn.textContent = t('course.abandoning');

        try {
            await apiPatch(`/enrollments/${courseId}`, { status: 'abandoned' });
            await showCourseOverview(courseId);
        } catch (error) {
            log.error('Abandon failed:', error);
            btn.disabled = false;
            btn.textContent = t('course.removeFromActive');
            alert(t('course.genericError', { msg: error.message }));
        }
    });
}

/**
 * Show course overview for a course
 * @param {string} courseId - Course ID
 */
export const showCourseOverview = async courseId => {
    try {
        const [course, enrollmentStatus] = await Promise.all([
            api(`/courses/${courseId}?lang=${getLanguage()}`),
            api(`/enrollments/${courseId}`).catch(err => {
                // Log the failure so operators can see broken enrollment APIs
                // ; default to non-enrolled+can-enroll so the course overview
                // still loads (enrollment status is non-blocking for view).
                log.warn(`enrollment fetch failed for course ${courseId}, defaulting to not-enrolled+can-enroll`, err);
                return { enrolled: false, can_enroll: true };
            })
        ]);
        
        await renderCourseOverview(course, enrollmentStatus);
    } catch (error) {
        log.error('Failed to show overview:', error);
        const viewer = document.getElementById('somViewer');
        if (viewer) {
            setSafeHtml(viewer, safeHtml`
                <div class="error">
                    <h2>${t('errors.title')}</h2>
                    <p>${t('course.loadError', { msg: error.message })}</p>
                </div>
            `);
        }
    }
};
