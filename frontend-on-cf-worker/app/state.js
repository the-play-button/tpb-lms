/**
 * Reactive State Management
 * 
 * Simple pub/sub pattern for automatic UI updates when state changes.
 * 
 * Usage:
 *   import { state, getState, setState, subscribe } from './state.js';
 *   
 *   // Subscribe to state changes
 *   subscribe('allBadges', (badges) => updateBadgesGrid(badges));
 *   
 *   // Update state (triggers subscribers)
 *   setState('allBadges', newBadges);
 */

// Application state
const state = {
    user: null,
    profile: null,
    badges: [],
    allBadges: [],
    courses: [],
    currentCourse: null,
    currentStepIndex: 0,
    courseData: null,
    signals: null
};

// Subscribers map: key -> [callback1, callback2, ...]
const subscribers = new Map();

// Session ID for API calls
export const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

/**
 * Get current state value
 */
export function getState(key) {
    return key ? state[key] : state;
}

/**
 * Set state value and notify subscribers
 */
export function setState(key, value) {
    const oldValue = state[key];
    state[key] = value;
    
    // Notify subscribers for this key
    if (subscribers.has(key)) {
        subscribers.get(key).forEach(callback => {
            try {
                callback(value, oldValue);
            } catch (e) {
                console.error(`State subscriber error for '${key}':`, e);
            }
        });
    }
    
    // Also notify '*' subscribers (global listeners)
    if (subscribers.has('*')) {
        subscribers.get('*').forEach(callback => {
            try {
                callback(key, value, oldValue);
            } catch (e) {
                console.error('Global state subscriber error:', e);
            }
        });
    }
}

/**
 * Subscribe to state changes
 * @param {string} key - State key to watch, or '*' for all changes
 * @param {function} callback - Called when state changes
 * @returns {function} Unsubscribe function
 */
export function subscribe(key, callback) {
    if (!subscribers.has(key)) {
        subscribers.set(key, []);
    }
    subscribers.get(key).push(callback);
    
    // Return unsubscribe function
    return () => {
        const callbacks = subscribers.get(key);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    };
}

export default state;

