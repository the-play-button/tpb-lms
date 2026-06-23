/**
 * Boot sequence orchestrator.
 *
 * Thin orchestration that delegates to per-phase modules to keep coupling low.
 * Phases : globals → debug → session → UI → listeners → features → route.
 */
import { log } from '../log.js';
import { showError } from '../notifications.js';
import { initLanguage, getLanguage } from '../../i18n/index.js';

import { initGlobals } from './globals.js';
import { initSessionData } from './initSessionData.js';
import { setupEventListeners } from './eventListeners.js';
import { initFeatures } from './initFeatures.js';

import { initAllUI } from '../ui/initAllUI.js';
import { loadCourse } from '../course/loader.js';
import { initAdminDashboard } from '../admin/dashboard.js';

export const runBootSequence = async () => {
    // Boot order : initGlobals MUST run first — it exposes the
    // user-callable window.X for HTML onclick handlers, installs the
    // debug collector native-global patches (onerror, fetch) early so
    // boot errors are captured, and wires the debug FAB UI
    // (§ global_pollution + § ALWAYS FAIL HARD).
    initGlobals();

    try {
        // 1. Session + courses + badges → state
        const { session, courses } = await initSessionData(getLanguage());

        // 2. UI subscriptions + initial render + user menu + lang selector
        initAllUI(session);

        // 3. Setup DOM event listeners
        setupEventListeners();

        // 4. Feature listeners (navigation + quiz + notifications + leaderboard + kms)
        initFeatures();

        // 5. Check for admin route
        if (window.location.pathname === '/admin') {
            initAdminDashboard();
            return;
        }

        // 6. Check URL for direct course link (GAP-203: support ?step=N)
        const urlParams = new URLSearchParams(window.location.search);
        const courseId = urlParams.get('som') || urlParams.get('course');
        const stepParam = urlParams.get('step');
        const initialStep = stepParam !== null ? Math.max(0, parseInt(stepParam, 10) - 1) : null;

        if (courseId) {
            loadCourse(courseId, initialStep);
        } else if (courses.length > 0) {
            loadCourse(courses[0].id, initialStep);
        }

    } catch (error) {
        log.error('Failed to initialize:', error);
        showError(error.message);
    }
};

// initLanguage runs at module load — see i18n/index.js for the language
// resolution sequence (localStorage → browser → DEFAULT).
initLanguage();
