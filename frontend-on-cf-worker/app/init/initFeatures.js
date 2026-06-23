/**
 * Feature module listeners — navigation + quiz + notifications.
 *
 * Consolidates per-feature init() calls into a single aggregator so
 * bootSequence.js does not need to import each feature module directly.
 */
import { initNavigation } from '../course/navigation.js';
import { initQuizHandler } from '../quiz/handler.js';
import { initNotifications } from '../notifications.js';
import { loadLeaderboard } from '../leaderboard.js';
import { initKmsLinks } from '../kms/viewer/index.js';

export const initFeatures = () => {
    initNavigation();
    initQuizHandler();
    initNotifications();
    loadLeaderboard();
    initKmsLinks();
};
