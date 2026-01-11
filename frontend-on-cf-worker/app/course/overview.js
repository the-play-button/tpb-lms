/**
 * Course Overview
 * 
 * Displays course introduction/overview before starting.
 * Fetches intro content from tpb_intro_url in course.raw.
 */

import { api } from '../api.js';
import { getState, setState } from '../state.js';
import { fetchMarkdown } from '../content/loader.js';
import { loadCourse } from './loader.js';

/**
 * Render course overview screen
 * @param {Object} course - Course data
 * @param {Object} enrollmentStatus - Enrollment status
 */
export async function renderCourseOverview(course, enrollmentStatus = null) {
    const viewer = document.getElementById('somViewer');
    if (!viewer) return;
    
    // Show loading state
    viewer.innerHTML = `
        <div class="course-overview loading">
            <div class="loading-spinner"></div>
            <p>Chargement du cours...</p>
        </div>
    `;
    
    try {
        // Get intro URL from course raw data
        const raw = course.raw ? JSON.parse(course.raw) : {};
        const introUrl = raw.tpb_intro_url;
        
        // Fetch intro content if available
        let introContent = '';
        if (introUrl) {
            try {
                const markdown = await fetchMarkdown(introUrl);
                introContent = marked.parse(markdown);
            } catch (error) {
                console.warn('Failed to fetch intro:', error);
                introContent = `<p>${course.description || 'Aucune description disponible.'}</p>`;
            }
        } else {
            introContent = `<p>${course.description || 'Aucune description disponible.'}</p>`;
        }
        
        // Get enrollment info
        const isEnrolled = enrollmentStatus?.enrolled && enrollmentStatus.enrollment?.status === 'active';
        const canEnroll = enrollmentStatus?.can_enroll ?? true;
        
        // Render overview
        viewer.innerHTML = `
            <div class="course-overview">
                <header class="overview-header">
                    <h1 class="course-title">${course.title || course.name}</h1>
                    ${course.categories?.length ? `
                        <div class="course-categories">
                            ${course.categories.map(cat => `<span class="category-tag">${cat}</span>`).join('')}
                        </div>
                    ` : ''}
                </header>
                
                <div class="overview-content markdown-body">
                    ${introContent}
                </div>
                
                <div class="course-meta">
                    <div class="meta-item">
                        <span class="meta-icon">📚</span>
                        <span class="meta-text">${course.classes?.length || 0} étapes</span>
                    </div>
                    ${course.progress ? `
                        <div class="meta-item">
                            <span class="meta-icon">📊</span>
                            <span class="meta-text">${course.progress.completed_steps}/${course.progress.total_steps} complétées</span>
                        </div>
                    ` : ''}
                </div>
                
                <div class="overview-actions">
                    ${renderEnrollmentButton(course, isEnrolled, canEnroll, enrollmentStatus)}
                </div>
                
                ${!canEnroll && !isEnrolled ? `
                    <div class="enrollment-limit-warning">
                        <span class="warning-icon">⚠️</span>
                        <p>Vous avez atteint la limite de ${enrollmentStatus?.max_active || 3} cours actifs. 
                        Terminez ou abandonnez un cours pour en commencer un nouveau.</p>
                    </div>
                ` : ''}
            </div>
        `;
        
        // Setup button handlers
        setupOverviewHandlers(course.id);
        
    } catch (error) {
        console.error('Failed to render overview:', error);
        viewer.innerHTML = `
            <div class="course-overview error">
                <h2>Erreur</h2>
                <p>Impossible de charger le cours: ${error.message}</p>
                <button class="btn-primary" onclick="window.location.reload()">Réessayer</button>
            </div>
        `;
    }
}

/**
 * Render appropriate enrollment button
 */
function renderEnrollmentButton(course, isEnrolled, canEnroll, enrollmentStatus) {
    if (isEnrolled) {
        const progress = enrollmentStatus?.enrollment?.progress_percent || 0;
        return `
            <button class="btn-primary btn-start" data-action="continue" data-course="${course.id}">
                ${progress > 0 ? `Continuer (${progress}%)` : 'Commencer le cours'} →
            </button>
            <button class="btn-secondary btn-abandon" data-action="abandon" data-course="${course.id}">
                Abandonner le cours
            </button>
        `;
    }
    
    if (canEnroll) {
        return `
            <button class="btn-primary btn-enroll" data-action="enroll" data-course="${course.id}">
                S'inscrire au cours
            </button>
        `;
    }
    
    return `
        <button class="btn-disabled" disabled>
            Limite d'inscriptions atteinte
        </button>
    `;
}

/**
 * Setup click handlers for overview buttons
 */
function setupOverviewHandlers(courseId) {
    // Enroll button
    document.querySelector('[data-action="enroll"]')?.addEventListener('click', async (e) => {
        const btn = e.target;
        btn.disabled = true;
        btn.textContent = 'Inscription...';
        
        try {
            await api(`/courses/${courseId}/enroll`, { method: 'POST' });
            // Reload course to start
            await loadCourse(courseId);
        } catch (error) {
            console.error('Enrollment failed:', error);
            btn.disabled = false;
            btn.textContent = 'Erreur - Réessayer';
            alert(`Erreur: ${error.message}`);
        }
    });
    
    // Continue button
    document.querySelector('[data-action="continue"]')?.addEventListener('click', async () => {
        await loadCourse(courseId);
    });
    
    // Abandon button
    document.querySelector('[data-action="abandon"]')?.addEventListener('click', async (e) => {
        if (!confirm('Êtes-vous sûr de vouloir abandonner ce cours ? Votre progression sera conservée.')) {
            return;
        }
        
        const btn = e.target;
        btn.disabled = true;
        btn.textContent = 'Abandon...';
        
        try {
            await api(`/courses/${courseId}/abandon`, { method: 'POST' });
            // Return to course list
            window.location.href = '/';
        } catch (error) {
            console.error('Abandon failed:', error);
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
export async function showCourseOverview(courseId) {
    try {
        // Fetch course and enrollment status in parallel
        const [course, enrollmentStatus] = await Promise.all([
            api(`/courses/${courseId}`),
            api(`/courses/${courseId}/enrollment`).catch(() => ({ enrolled: false, can_enroll: true }))
        ]);
        
        await renderCourseOverview(course, enrollmentStatus);
    } catch (error) {
        console.error('Failed to show overview:', error);
        const viewer = document.getElementById('somViewer');
        if (viewer) {
            viewer.innerHTML = `
                <div class="error">
                    <h2>Erreur</h2>
                    <p>Impossible de charger le cours: ${error.message}</p>
                </div>
            `;
        }
    }
}
