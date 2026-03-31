// entropy-single-export-ok: render + init pattern
/**
 * Course List UI Component
 */
import { getState, subscribe } from '../state.js';
import { renderMasteryBadge, getMasteryLevel, injectMasteryStyles } from './masteryBadge.js';

export const renderCourseList = () => {
    const list = document.getElementById('somList');
    if (!list) return;
    
    const courses = getState('courses') || [];
    const currentCourse = getState('currentCourse');
    
    injectMasteryStyles();
    
    list.innerHTML = courses.map(course => {
        const hasProgress = course.progress && course.progress.steps_completed > 0;
        const statusClass = course.progress?.course_completed ? 'completed' : (hasProgress ? 'in-progress' : '');
        const activeClass = course.id === currentCourse ? 'active' : '';
        
        const progressPercent = course.progress?.progress_percent || 0;
        const masteryLevel = getMasteryLevel(progressPercent);
        const masteryBadge = renderMasteryBadge(masteryLevel, { size: 'small' });
        
        return `
            <li>
                <a href="#" class="${statusClass} ${activeClass}" data-som-id="${course.id}">
                    <span class="course-title">${course.title}</span>
                    <span class="course-badges">
                        ${masteryBadge}
                    ${course.progress?.course_completed ? ' ✅' : ''}
                    </span>
                </a>
            </li>
        `;
    }).join('');
};

export const initCourseList = () => {
    subscribe('courses', renderCourseList);
    subscribe('currentCourse', renderCourseList);
};