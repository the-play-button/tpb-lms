/**
 * Global window.X exposures — SSOT for window pollution.
 *
 * Per CLAUDE.md doctrine § global_pollution : window.X assignments live
 * centralized here, not scattered across feature modules. Two categories :
 *
 *   1. User-callable functions for HTML onclick="" attributes
 *      (nextStep, showQuiz, closeKmsModal, ...).
 *
 *   2. Cross-module bridges consumed by other modules via window.X
 *      (showToast, LMSLog, i18n).
 *
 *   3. Native browser-global patches from the debug collector
 *      (onerror, fetch).
 *
 * New global = add it here, document the consumer that needs it.
 */
import { nextStep, prevStep, restartModule, navigateToStep } from '../course/navigation.js';
import { cyclePlaybackSpeed } from '../video/tracking/playbackSpeed.js';
import { closeBadgeModal } from '../notifications.js';
import { showQuiz } from '../quiz/handler.js';
import { closeKmsModal } from '../kms/viewer/renderKmsModal.js';
import { showToast } from '../../components/toast.js';
import { log as lmsLog } from '../../utils/log.js';
import { i18nApi } from '../../i18n/index.js';
import { initDebugCollector } from '../debug/collector/index.js';
import { initDebugFab } from '../debug/fab.js';

/**
 * Expose user-callable functions on window for HTML onclick attributes
 * + install native-global patches from the debug collector.
 * Called once at app boot from index.js.
 */
export const initGlobals = () => {
    // Category 1 : course navigation (= HTML buttons in course/step pages)
    window.nextStep = nextStep;
    window.prevStep = prevStep;
    window.restartModule = restartModule;
    window.navigateToStep = navigateToStep;
    window.cycleSpeed = cyclePlaybackSpeed; // GAP-101 playback speed control

    // Category 1 : notifications (= badge modal close button)
    window.closeBadgeModal = closeBadgeModal;

    // Category 1 : quiz (= "Start quiz" HTML button in step renderer)
    window.showQuiz = showQuiz;

    // Category 1 : KMS viewer (= modal close button)
    window.closeKmsModal = closeKmsModal;

    // Category 2 : cross-module bridges for window-based access.
    // Direct ES imports are preferred ; window bridge remains for callsites
    // that rely on optional-chaining (window.i18n?.getLanguage?.()) and for
    // browser DevTools convenience (window.LMSLog).
    window.showToast = showToast;
    window.LMSLog = lmsLog;
    window.i18n = i18nApi;

    // Category 3 : debug collector native-global patches.
    // initDebugCollector() returns the two patch handlers ; assignment happens
    // here (SSOT) per § global_pollution. Returns null on re-entry (already
    // initialized) — skip patching in that case.
    const patches = initDebugCollector();
    if (patches) {
        window.onerror = patches.onerrorPatch;
        window.fetch = patches.fetchPatch;
    }

    // Floating debug action button (UI module, no native global writes).
    initDebugFab();
};
