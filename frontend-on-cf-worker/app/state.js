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

const subscribers = new Map();

/** Subscriber isolation registry — broken subscribers added here so the
 *  notification chain stays robust (one bad sub doesn't break others) while
 *  failures stay observable via console.error. Per § ALWAYS FAIL HARD :
 *  explicit registry + log instead of silent swallow. */
const brokenSubscribers = new Set();

export const sessionId = `session_${crypto.randomUUID()}`;

/**
 * Get current state value
 */
export const getState = key => {
    return key ? state[key] : state;
};

/**
 * Set state value and notify subscribers
 */
export const setState = (key, value) => {
    const oldValue = state[key];
    state[key] = value;
    
    if (subscribers.has(key)) {
        subscribers.get(key).forEach(callback => {
            try {
                callback(value, oldValue);
            } catch (e) {
                // Constant format string — key passed as structured arg so
                // an attacker-controlled key can't forge log specifiers.
                console.error('State subscriber error', { key, error: e });
                brokenSubscribers.add(callback);
            }
        });
    }

    if (subscribers.has('*')) {
        subscribers.get('*').forEach(callback => {
            try {
                callback(key, value, oldValue);
            } catch (e) {
                console.error('Global state subscriber error:', e);
                brokenSubscribers.add(callback);
            }
        });
    }
};

/**
 * Subscribe to state changes
 * @param {string} key - State key to watch, or '*' for all changes
 * @param {function} callback - Called when state changes
 * @returns {function} Unsubscribe function
 */
export const subscribe = (key, callback) => {
    if (!subscribers.has(key)) {
        subscribers.set(key, []);
    }
    subscribers.get(key).push(callback);
    
    return () => {
        const callbacks = subscribers.get(key);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    };
};

export default state;

