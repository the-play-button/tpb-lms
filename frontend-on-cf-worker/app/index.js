/**
 * LMS Frontend Application
 *
 * DOMContentLoaded entrypoint — delegates to init/bootSequence.js.
 *
 * Architecture:
 * - Reactive state (state.js) - setState triggers subscribed UI updates
 * - Modular components (ui/, course/, video/, quiz/)
 * - Event-based backend communication (VIDEO_PING, QUIZ_SUBMIT)
 */
import { runBootSequence } from './init/bootSequence.js';

const onDomReady = () => runBootSequence();
document.addEventListener('DOMContentLoaded', onDomReady);
