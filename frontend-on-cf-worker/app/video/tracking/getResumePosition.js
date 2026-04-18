/**
 * Get resume position for a class from signals (GAP-102)
 */

import { getState } from '../../state.js';
import { RESUME_THRESHOLD } from './_shared.js';

/**
 * Get resume position for a class from signals (GAP-102)
 * @param {string} classId - The class ID to get position for
 * @returns {number|null} - Position in seconds, or null if none
 */
export const getResumePosition = classId => {
    const videoPositions = getState('signals')?.video_positions || {};
    const positionData = videoPositions[classId];

    if (positionData && positionData.position >= RESUME_THRESHOLD) {
        return positionData.position;
    }
    return null;
};
