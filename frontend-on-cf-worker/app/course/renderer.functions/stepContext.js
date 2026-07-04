/**
 * Step context builder — resolves the current course / step / signals
 * into a single context object consumed by every render helper.
 */
import { getState } from '../../state.js';
import { getMediaByType, getVideoInfo } from './_mediaHelpers.js';
import { resolveProvider } from '../../video/providers/index.js';

const getStepSignalData = (signals, classId) => {
    const stepSignal = signals?.steps?.find(({ class_id } = {}) => class_id === classId) || {};
    return {
        hasQuiz: stepSignal.has_quiz || false,
        videoCompleted: stepSignal.video_completed || false,
        quizPassed: stepSignal.quiz_passed || false,
        stepCompleted: stepSignal.step_completed || false
    };
};

export const getStepContext = () => {
    const course = getState('courseData');
    const { classes = [] } = course ?? {};
    if (!classes.length) return null;

    const signals = getState('signals');
    const stepIndex = getState('currentStepIndex');
    const cls = classes[stepIndex];

    const videoInfo = getVideoInfo(cls);
    const resolvedVideo = videoInfo.hasVideo ? resolveProvider(videoInfo.media) : null;
    const signalData = getStepSignalData(signals, cls.id);

    return {
        course, cls, stepIndex,
        currentCourse: getState('currentCourse'),
        totalSteps: course.classes.length,
        // Resolved VideoProvider (hexagonal port) — null when no video / unknown host.
        hasVideo: !!resolvedVideo,
        videoProviderId: resolvedVideo?.provider.id ?? null,
        videoParsed: resolvedVideo?.parsed ?? null,
        videoDuration: videoInfo.duration,
        quizMedia: getMediaByType(cls, 'QUIZ', 'tally_form_id') || getMediaByType(cls, 'WEB', 'tally_form_id'),
        ...signalData
    };
};
