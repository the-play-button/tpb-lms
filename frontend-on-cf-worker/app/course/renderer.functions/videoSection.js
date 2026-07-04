/**
 * Video section renderer — thin dispatcher over the VideoProvider port. The
 * resolved provider (youtube / loom / cloudflare / mp4) owns the embed markup.
 */
import { t } from '../../../i18n/index.js';
import { resolveProviderById } from '../../video/providers/index.js';

export const renderVideoSection = ctx => {
    const { videoProviderId, videoParsed, stepIndex, currentCourse, cls, videoDuration, quizPassed, hasQuiz } = ctx;

    if (quizPassed && hasQuiz) {
        return `
            <div class="video-locked">
                <div class="locked-icon">🔒</div>
                <p>${t('course.videoLocked')}</p>
            </div>
        `;
    }

    if (!videoProviderId || !videoParsed) return '';
    const provider = resolveProviderById(videoProviderId);
    if (!provider) return '';

    return provider.renderEmbed({
        parsed: videoParsed,
        stepIndex,
        courseId: currentCourse,
        classId: cls.id,
        videoDuration,
        cls,
    });
};
