/**
 * Step requirements renderer — checklist of what must be completed to
 * unlock the Next button (video 90% + quiz pass).
 */
import { t } from '../../../i18n/index.js';

export const renderRequirements = ctx => {
    const { cls, hasQuiz, videoCompleted, quizPassed, stepCompleted, videoId, videoYoutubeId, videoUrl, quizMedia } = ctx;

    if (stepCompleted) return '';

    const hasVideo = !!(videoId || videoYoutubeId || videoUrl || cls.content_md?.includes('cloudflarestream.com'));
    const hasQuizContent = !!quizMedia;
    if (!hasVideo && !hasQuizContent) {
        return ''; // CONTENT step - no requirements
    }

    return `
        <div class="step-requirements">
            <h4>${t('requirements.title')}</h4>
            <ul>
                ${hasVideo ? `
                    <li class="${videoCompleted ? 'done' : 'pending'}">
                        ${videoCompleted ? '✅' : '⏳'} ${t('course.watchVideo')}
                    </li>
                ` : ''}
                ${hasQuiz ? `
                    <li class="${quizPassed ? 'done' : 'pending'}">
                        ${quizPassed ? '✅' : '⏳'} ${t('requirements.passQuiz')}
                    </li>
                ` : ''}
            </ul>
        </div>
    `;
};
