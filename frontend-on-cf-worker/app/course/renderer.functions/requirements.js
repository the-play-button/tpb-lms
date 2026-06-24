/**
 * Step requirements renderer — checklist of what must be completed to
 * unlock the « Suivant » button (video 90% + quiz pass).
 */

export const renderRequirements = ctx => {
    const { cls, hasQuiz, videoCompleted, quizPassed, stepCompleted, videoId, videoUrl, quizMedia } = ctx;

    if (stepCompleted) return '';

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
};
