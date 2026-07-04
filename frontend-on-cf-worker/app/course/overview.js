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
            <p>Chargement du cours...</p>
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
                introContent = safeHtml`<p>${course.description || 'Aucune description disponible.'}</p>`;
            }
        } else if (introUrl) {
            try {
                const markdown = await fetchMarkdown(introUrl);
                introContent = marked.parse(markdown);
            } catch (error) {
                log.warn('Failed to fetch intro:', error);
                introContent = safeHtml`<p>${course.description || 'Aucune description disponible.'}</p>`;
            }
        } else {
            introContent = safeHtml`<p>${course.description || 'Aucune description disponible.'}</p>`;
        }
        
        const isEnrolled = enrollmentStatus?.enrolled && enrollmentStatus.enrollment?.status === 'active';
        const canEnroll = enrollmentStatus?.can_enroll ?? true;
        
        const categoriesHtml = course.categories?.length
            ? safeHtml`<div class="course-categories">${raw(course.categories.map((cat) => safeHtml`<span class="category-tag">${cat}</span>`).join(''))}</div>`
            : '';
        const progressHtml = course.progress
            ? safeHtml`<div class="meta-item"><span class="meta-icon">📊</span><span class="meta-text">${course.progress.completed_steps}/${course.progress.total_steps} complétées</span></div>`
            : '';
        const enrollmentWarningHtml = !canEnroll && !isEnrolled
            ? safeHtml`<div class="enrollment-limit-warning"><span class="warning-icon">⚠️</span><p>Vous avez atteint la limite de ${enrollmentStatus?.max_active || 3} cours actifs. Terminez ou abandonnez un cours pour en commencer un nouveau.</p></div>`
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
                        <span class="meta-text">${course.classes?.length || 0} étapes</span>
                    </div>
                    ${raw(progressHtml)}
                </div>

                <div class="overview-actions">
                    ${raw(renderEnrollmentButton(course, isEnrolled, canEnroll, enrollmentStatus))}
                </div>

                ${raw(enrollmentWarningHtml)}
            </div>
        `);
        
        setupOverviewHandlers(course.id);
        
    } catch (error) {
        log.error('Failed to render overview:', error);
        setSafeHtml(viewer, safeHtml`
            <div class="course-overview error">
                <h2>Erreur</h2>
                <p>Impossible de charger le cours: ${error.message}</p>
                <button class="btn-primary" data-testid="overview-reload-btn" onclick="window.location.reload()">Réessayer</button>
            </div>
        `);
    }
};

/**
 * Render appropriate enrollment button
 */
const renderEnrollmentButton = (course, isEnrolled, canEnroll, enrollmentStatus) => {
    if (isEnrolled) {
        const { enrollment: { progress_percent = 0 } = {} } = enrollmentStatus ?? {};
        const label = progress_percent > 0 ? `Continuer (${progress_percent}%)` : 'Commencer le cours';
        return safeHtml`
            <button class="btn-primary btn-start" data-testid="course-continue-btn" data-action="continue" data-course="${course.id}">
                ${label} →
            </button>
            <button class="btn-secondary btn-abandon" data-testid="course-abandon-btn" data-action="abandon" data-course="${course.id}">
                Abandonner le cours
            </button>
        `;
    }

    if (canEnroll) {
        return safeHtml`
            <button class="btn-primary btn-enroll" data-testid="course-enroll-btn" data-action="enroll" data-course="${course.id}">
                S'inscrire au cours
            </button>
        `;
    }

    return safeHtml`
        <button class="btn-disabled" data-testid="course-limit-btn" disabled>
            Limite d'inscriptions atteinte
        </button>
    `;
};

/**
 * Setup click handlers for overview buttons
 */
const setupOverviewHandlers = (courseId) => {
    document.querySelector('[data-action="enroll"]')?.addEventListener('click', async (e) => {
        const btn = e.target;
        btn.disabled = true;
        btn.textContent = 'Inscription...';
        
        try {
            await apiPost('/enrollments', { courseId });
            await loadCourse(courseId);
        } catch (error) {
            log.error('Enrollment failed:', error);
            btn.disabled = false;
            btn.textContent = 'Erreur - Réessayer';
            alert(`Erreur: ${error.message}`);
        }
    });
    
    document.querySelector('[data-action="continue"]')?.addEventListener('click', async () => {
        await loadCourse(courseId);
    });
    
    document.querySelector('[data-action="abandon"]')?.addEventListener('click', async (e) => {
        if (!confirm('Êtes-vous sûr de vouloir abandonner ce cours ? Votre progression sera conservée.')) {
            return;
        }
        
        const btn = e.target;
        btn.disabled = true;
        btn.textContent = 'Abandon...';
        
        try {
            await apiPatch(`/enrollments/${courseId}`, { status: 'abandoned' });
            window.location.href = '/';
        } catch (error) {
            log.error('Abandon failed:', error);
            btn.disabled = false;
            btn.textContent = 'Abandonner le cours';
            alert(`Erreur: ${error.message}`);
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
            api(`/courses/${courseId}`),
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
                    <h2>Erreur</h2>
                    <p>Impossible de charger le cours: ${error.message}</p>
                </div>
            `);
        }
    }
};
