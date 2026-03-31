// entropy-single-export-ok: render + init pattern
// entropy-prohibited-timer-ok: timer use is intentional
/**
 * User Stats UI Component
 */
import { getState, subscribe } from '../state.js';
import { formatNumber } from '../utils.js';

let previousXP = null;

export const updateUserStats = () => {
    const profile = getState('profile') || {};
    const courses = getState('courses') || [];
    
    const streakEl = document.getElementById('streakDays');
    const xpEl = document.getElementById('totalXP');
    const levelEl = document.getElementById('userLevel');
    const coursesEl = document.getElementById('somsCompleted');
    
    const currentXP = profile.total_points || 0;
    
    if (previousXP !== null && currentXP > previousXP) {
        const xpStat = document.querySelector('.stat.xp');
        if (xpStat) {
            xpStat.classList.add('animating');
            showFloatingXP(currentXP - previousXP, xpStat);
            // entropy-prohibited-timer-ok: cleanup after CSS animation
            setTimeout(() => xpStat.classList.remove('animating'), 400);
        }
    }
    previousXP = currentXP;
    
    if (streakEl) streakEl.textContent = profile.current_streak || 0;
    if (xpEl) xpEl.textContent = formatNumber(currentXP);
    if (levelEl) levelEl.textContent = profile.level || 1;
    
    if (coursesEl) {
        const completedCourses = courses.filter(({ progress } = {}) => 
            progress && progress.course_completed
        ).length;
        coursesEl.textContent = completedCourses;
    }
};

const showFloatingXP = (amount, anchorEl) => {
    const rect = anchorEl.getBoundingClientRect();
    const float = document.createElement('div');
    float.className = 'xp-float';
    float.textContent = `+${amount}`;
    float.style.left = `${rect.left + rect.width / 2}px`;
    float.style.top = `${rect.top}px`;
    document.body.appendChild(float);
    // entropy-prohibited-timer-ok: cleanup after CSS animation
    setTimeout(() => float.remove(), 1500);
}

export const initUserStats = () => {
    subscribe('profile', updateUserStats);
    subscribe('courses', updateUserStats);
};