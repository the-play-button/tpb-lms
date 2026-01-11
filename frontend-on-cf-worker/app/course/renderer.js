/**
 * Course Step Renderer
 * 
 * Renders current step content, video, quiz UI.
 * Refactored for reduced complexity (split into smaller functions).
 * 
 * Unified.to Conformity:
 * - Reads step_type from raw_json.tpb_step_type
 * - Fetches content from media[].url for DOCUMENT type
 */

import { getState } from '../state.js';
import { setupVideoTracking, getResumePosition } from '../video/tracking.js';
import { fetchMarkdown, getDocumentUrl } from '../content/loader.js';
import { showContentStepConfirmation } from './confirmModal.js';

/**
 * Get media from class by type
 */
function getMediaByType(cls, type, extraCheck = null) {
    const media = cls.media || [];
    return media.find(m => m.type === type && (!extraCheck || m[extraCheck]));
}

/**
 * Get document media (DOCUMENT type with url)
 */
function getDocumentMedia(cls) {
    const media = cls.media || [];
    return media.find(m => m.type === 'DOCUMENT' && m.url);
}

/**
 * Get subtitle tracks from class media
 * @returns {Array<{url: string, lang: string, label: string}>}
 */
function getSubtitleTracks(cls) {
    const media = cls.media || [];
    const subtitles = media.filter(m => m.type === 'SUBTITLE' || m.type === 'CAPTION');
    
    const langLabels = {
        fr: 'Français',
        en: 'English',
        es: 'Español',
        de: 'Deutsch',
        it: 'Italiano',
        pt: 'Português'
    };
    
    return subtitles.map(sub => ({
        url: sub.url || sub.vtt_url,
        lang: sub.lang || 'en',
        label: sub.label || langLabels[sub.lang] || sub.lang
    })).filter(sub => sub.url);
}

/**
 * Get video info from media (supports stream_id or video_url)
 */
function getVideoInfo(cls) {
    const videoMedia = getMediaByType(cls, 'VIDEO');
    if (!videoMedia) return { hasVideo: false };
    
    return {
        hasVideo: true,
        streamId: videoMedia.stream_id,
        videoUrl: videoMedia.video_url,
        duration: videoMedia.duration_sec || 300
    };
}

/**
 * Get step signal data with defaults
 */
function getStepSignalData(signals, classId) {
    const stepSignal = signals?.steps?.find(s => s.class_id === classId) || {};
    return {
        hasQuiz: stepSignal.has_quiz || false,
        videoCompleted: stepSignal.video_completed || false,
        quizPassed: stepSignal.quiz_passed || false,
        stepCompleted: stepSignal.step_completed || false
    };
}

/**
 * Get step context (state + signals)
 */
function getStepContext() {
    const course = getState('courseData');
    if (!course?.classes?.length) return null;
    
    const signals = getState('signals');
    const stepIndex = getState('currentStepIndex');
    const cls = course.classes[stepIndex];
    
    const videoInfo = getVideoInfo(cls);
    const signalData = getStepSignalData(signals, cls.id);
    
    return {
        course, cls, stepIndex,
        currentCourse: getState('currentCourse'),
        totalSteps: course.classes.length,
        videoId: videoInfo.streamId,
        videoUrl: videoInfo.videoUrl,
        videoDuration: videoInfo.duration,
        quizMedia: getMediaByType(cls, 'QUIZ', 'tally_form_id'),
        ...signalData
    };
}

/**
 * Render video/content section
 */
function renderVideoContent(ctx) {
    const { cls, stepIndex, currentCourse, videoId, videoUrl, videoDuration, quizPassed, hasQuiz } = ctx;
    
    // Quiz passed - video locked
    if (quizPassed && hasQuiz) {
        return `
            <div class="video-locked">
                <div class="locked-icon">🔒</div>
                <p>La vidéo n'est plus accessible après le quiz.</p>
            </div>
        `;
    }
    
    // Speed control button (GAP-101) - shown when video is present
    const speedControl = (videoId || videoUrl || cls.content_md) ? `
        <div class="video-controls" style="display: flex; justify-content: flex-end; margin-bottom: 0.5rem; gap: 0.5rem;">
            <button class="speed-btn" onclick="window.cycleSpeed()" 
                    title="Changer la vitesse de lecture (0.5x - 2x)"
                    style="padding: 0.5rem 1rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text-primary); cursor: pointer; font-size: 0.875rem; font-weight: 500; transition: all 0.2s;">
                <span id="speed-display">1x</span> ⚡
            </button>
        </div>
    ` : '';
    
    // Check for DOCUMENT media (unified.to conformity - content served from GitHub)
    const documentMedia = getDocumentMedia(cls);
    if (documentMedia) {
        // Content will be loaded async, return placeholder
        return `
            <div id="document-content-${cls.id}" class="document-content loading">
                <div class="loading-spinner"></div>
                <p>Chargement du contenu...</p>
            </div>
        `;
    }
    
    // Has inline markdown content (legacy - tpb_content_md)
    if (cls.content_md) {
        let html = marked.parse(cls.content_md);
        
        // Get current language for CC sync
        const currentLang = window.i18n?.getLanguage?.() || 'fr';
        
        // Transform Stream URLs to iframes with CC enabled
        html = html.replace(
            /<p><a href="https:\/\/customer-[\w]+\.cloudflarestream\.com\/([\w]+)\/iframe"[^>]*>[^<]+<\/a><\/p>/g,
            `<div class="video-container">
                <iframe src="https://iframe.cloudflarestream.com/$1?preload=metadata&defaultTextTrack=${currentLang}"
                    style="border: none; width: 100%; aspect-ratio: 16/9; border-radius: 8px;"
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                    allowfullscreen="true" id="video-player-${stepIndex}"
                    data-video-id="$1" data-video-duration="${videoDuration}"
                    data-course-id="${currentCourse}" data-class-id="${cls.id}">
                </iframe>
            </div>`
        );
        
        // Remove dead .md links
        html = html.replace(/<p>(<a href="[^"]*\.md">[^<]+<\/a>[\s|]*)+<\/p>/g, '');
        
        return speedControl + html;
    }
    
    // Has Cloudflare Stream video
    if (videoId) {
        // Get current language for CC sync
        const currentLang = window.i18n?.getLanguage?.() || 'fr';
        // Build iframe URL with CC enabled and synced to UI language
        const streamParams = new URLSearchParams({
            preload: 'metadata',
            defaultTextTrack: currentLang  // Auto-enable CC in UI language
        });
        
        return `
            ${speedControl}
            <div class="video-container">
                <iframe src="https://iframe.cloudflarestream.com/${videoId}?${streamParams.toString()}"
                    style="border: none; width: 100%; aspect-ratio: 16/9; border-radius: 8px;"
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                    allowfullscreen="true" id="video-player-${stepIndex}"
                    data-video-id="${videoId}" data-video-duration="${videoDuration}"
                    data-course-id="${currentCourse}" data-class-id="${cls.id}">
                </iframe>
            </div>
            ${cls.description ? `<p class="step-description">${cls.description}</p>` : ''}
        `;
    }
    
    // Has external video URL (Descript, YouTube, Vimeo, etc.)
    if (videoUrl) {
        // Get subtitle tracks from media
        const subtitles = getSubtitleTracks(cls);
        const currentLang = window.i18n?.getLanguage?.() || 'fr';
        
        return `
            ${speedControl}
            <div class="video-container">
                <video controls preload="metadata"
                    style="width: 100%; aspect-ratio: 16/9; border-radius: 8px; background: #000;"
                    id="video-player-${stepIndex}"
                    data-video-url="${videoUrl}" data-video-duration="${videoDuration}"
                    data-course-id="${currentCourse}" data-class-id="${cls.id}">
                    <source src="${videoUrl}" type="video/mp4">
                    ${subtitles.map(sub => `
                        <track kind="subtitles" src="${sub.url}" srclang="${sub.lang}" 
                               label="${sub.label}" ${sub.lang === currentLang ? 'default' : ''}>
                    `).join('')}
                    Your browser does not support the video tag.
                </video>
            </div>
            ${cls.description ? `<p class="step-description">${cls.description}</p>` : ''}
        `;
    }
    
    // No content
    return cls.description 
        ? `<p class="step-description">${cls.description}</p>` 
        : '<p>Aucun contenu disponible pour cette étape.</p>';
}

/**
 * Load document content async after render
 */
async function loadDocumentContent(cls) {
    const documentMedia = getDocumentMedia(cls);
    if (!documentMedia) return;
    
    const container = document.getElementById(`document-content-${cls.id}`);
    if (!container) return;
    
    try {
        const markdown = await fetchMarkdown(documentMedia.url);
        const html = marked.parse(markdown);
        
        container.classList.remove('loading');
        container.innerHTML = `<div class="markdown-body">${html}</div>`;
    } catch (error) {
        console.error('Failed to load document content:', error);
        container.classList.remove('loading');
        container.classList.add('error');
        container.innerHTML = `
            <div class="error-message">
                <p>Erreur lors du chargement du contenu.</p>
                <button onclick="window.location.reload()">Réessayer</button>
            </div>
        `;
    }
}

/**
 * Render quiz section
 */
function renderQuizSection(ctx) {
    const { cls, quizMedia, videoCompleted, quizPassed } = ctx;
    
    if (!quizMedia) return '';
    
    const quizName = quizMedia.name || 'Quiz de validation';
    const formId = quizMedia.tally_form_id;
    
    if (quizPassed) {
        return `
            <div class="step-quiz quiz-passed">
                <div class="quiz-header">
                    <h3>🎯 ${quizName}</h3>
                    <span class="quiz-badge">✅ Quiz réussi</span>
                </div>
            </div>
        `;
    }
    
    if (!videoCompleted) {
        return `
            <div class="step-quiz quiz-locked">
                <div class="quiz-header">
                    <h3>🎯 ${quizName}</h3>
                    <span class="quiz-badge">🔒 Verrouillé</span>
                </div>
                <p class="quiz-locked-msg">Regardez la vidéo à 90% minimum pour débloquer le quiz.</p>
            </div>
        `;
    }
    
    return `
        <div class="step-quiz quiz-ready">
            <div class="quiz-header">
                <h3>🎯 ${quizName}</h3>
                <span class="quiz-badge">✅ Débloqué</span>
            </div>
            <div class="quiz-warning">
                <div class="warning-icon">⚠️</div>
                <div class="warning-text">
                    <strong>Attention - Une seule tentative</strong>
                    <p>Vous n'aurez qu'<strong>une seule tentative</strong> pour ce quiz.</p>
                </div>
            </div>
            <button class="quiz-start-btn" onclick="window.showQuiz('${cls.id}', '${formId}', '${quizName.replace(/'/g, "\\'")}')">
                Commencer le quiz
            </button>
            <div id="quiz-container-${cls.id}" class="quiz-container" style="display: none;"></div>
        </div>
    `;
}

/**
 * Render requirements checklist
 */
function renderRequirements(ctx) {
    const { cls, hasQuiz, videoCompleted, quizPassed, stepCompleted, videoId, videoUrl, quizMedia } = ctx;
    
    if (stepCompleted) return '';
    
    // Check if this is a CONTENT step (no video, no quiz) - no requirements to show
    const hasVideo = !!(videoId || videoUrl || cls.content_md?.includes('cloudflarestream.com'));
    const hasQuizContent = !!quizMedia;
    if (!hasVideo && !hasQuizContent) {
        return ''; // CONTENT step - no requirements
    }
    
    return `
        <div class="step-requirements">
            <h4>Pour débloquer "Suivant" :</h4>
            <ul>
                ${hasVideo ? `
                    <li class="${videoCompleted ? 'done' : 'pending'}">
                        ${videoCompleted ? '✅' : '⏳'} Regarder la vidéo à 90%+
                    </li>
                ` : ''}
                ${hasQuiz ? `
                    <li class="${quizPassed ? 'done' : 'pending'}">
                        ${quizPassed ? '✅' : '⏳'} Passer le quiz
                    </li>
                ` : ''}
            </ul>
        </div>
    `;
}

/**
 * Render current step (main orchestrator)
 */
export function renderCurrentStep() {
    const ctx = getStepContext();
    if (!ctx) return;
    
    const { cls, stepIndex, totalSteps, stepCompleted, videoId, videoUrl, quizMedia } = ctx;
    const isLastStep = stepIndex === totalSteps - 1;
    
    // Check if this is a CONTENT step (no video, no quiz)
    const hasVideo = !!(videoId || videoUrl || cls.content_md?.includes('cloudflarestream.com'));
    const hasQuiz = !!quizMedia;
    const isContentStep = !hasVideo && !hasQuiz;
    
    // CONTENT steps can always proceed; VIDEO/QUIZ need stepCompleted
    const canProceed = isContentStep || stepCompleted;
    
    const viewer = document.getElementById('somViewer');
    
    viewer.innerHTML = `
        <div class="step-viewer">
            <div class="step-header">
                <div class="step-progress">
                    <span class="step-counter">Étape ${stepIndex + 1} / ${totalSteps}</span>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${((stepIndex + 1) / totalSteps) * 100}%"></div>
                    </div>
                </div>
                <h2 class="step-title">${cls.name}</h2>
            </div>
            
            <div class="step-content markdown-body">
                ${renderVideoContent(ctx)}
            </div>
            
            ${renderQuizSection(ctx)}
            
            <div class="step-navigation">
                <button class="nav-btn prev" disabled title="Progression linéaire - pas de retour">← Précédent</button>
                <button class="nav-btn next" ${canProceed ? '' : 'disabled'} onclick="window.nextStep()" 
                    title="${!canProceed ? 'Complétez la vidéo et le quiz pour continuer' : (isLastStep ? 'Terminer le module' : 'Étape suivante')}">
                    ${isLastStep ? 'Terminer 🎉' : 'Suivant →'}
                </button>
            </div>
            
            ${renderRequirements(ctx)}
        </div>
    `;
    
    // GAP-102: Get resume position for this class and setup video tracking
    const resumePosition = getResumePosition(cls.id);
    setupVideoTracking(stepIndex, resumePosition);
    
    // Load document content async if present
    const documentMedia = getDocumentMedia(cls);
    if (documentMedia) {
        loadDocumentContent(cls);
    }
}

/**
 * Update UI elements without resetting the video iframe.
 */
export function updateUIWithoutVideoReset() {
    const ctx = getStepContext();
    if (!ctx) return;
    
    const { cls, quizMedia, videoCompleted, quizPassed, stepCompleted } = ctx;
    
    // 1. Update requirements checklist
    const videoLi = document.querySelector('.step-requirements ul li:first-child');
    if (videoLi) {
        videoLi.className = videoCompleted ? 'done' : 'pending';
        videoLi.innerHTML = `${videoCompleted ? '✅' : '⏳'} Regarder la vidéo à 90%+`;
    }
    
    // 2. Unlock quiz if video just completed
    if (quizMedia && videoCompleted && !quizPassed) {
        const quizSection = document.querySelector('.step-quiz.quiz-locked');
        if (quizSection) {
            quizSection.outerHTML = renderQuizSection(ctx);
        }
    }
    
    // 3. Enable next/finish button if step completed
    const nextBtn = document.querySelector('.nav-btn.next');
    if (nextBtn && stepCompleted) {
        nextBtn.disabled = false;
        const course = getState('courseData');
        const stepIndex = getState('currentStepIndex');
        const isLastStep = stepIndex === course.classes.length - 1;
        nextBtn.title = isLastStep ? 'Terminer le module' : 'Étape suivante';
    }
}
