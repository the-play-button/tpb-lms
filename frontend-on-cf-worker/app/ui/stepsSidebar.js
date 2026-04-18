// entropy-single-export-ok: 5 exports share sidebar DOM state, tightly-coupled sidebar lifecycle utilities
/**
 * Steps Sidebar
 * 
 * Displays course steps in a sidebar with progress indicators.
 * Non-clickable for hyper-linear progression.
 */

import { getState } from '../state.js';

/**
 * Render the steps sidebar
 * @param {Object} options - Render options
 * @param {boolean} options.showSections - Group steps by section (default: true)
 */
export const renderStepsSidebar = (options = {}) => {
    const { showSections = true } = options;
    
    const course = getState('courseData');
    const signals = getState('signals');
    const currentStepIndex = getState('currentStepIndex');
    
    const { classes = [] } = course ?? {};
    if (!classes.length) return;
    
    const sidebar = document.getElementById('stepsSidebar');
    if (!sidebar) return;
    
    const completedSteps = new Set(
        (signals?.steps || [])
            .filter(({ step_completed } = {}) => step_completed)
            .map(({ class_id } = {}) => class_id)
    );
    
    const grouped = showSections ? groupBySection(classes) : { '': classes };
    
    let html = `
        <div class="sidebar-header">
            <h3 class="sidebar-title">${course.title || course.name}</h3>
            <div class="sidebar-progress">
                <span class="progress-text">${completedSteps.size}/${course.classes.length}</span>
                <div class="progress-bar-mini">
                    <div class="progress-fill" style="width: ${(completedSteps.size / course.classes.length) * 100}%"></div>
                </div>
            </div>
        </div>
        <nav class="steps-list">
    `;
    
    for (const [section, steps] of Object.entries(grouped)) {
        if (section && showSections) {
            html += `<div class="section-header">${section}</div>`;
        }
        
        for (const step of steps) {
            const index = course.classes.findIndex(({ id } = {}) => id === step.id);
            const isCompleted = completedSteps.has(step.id);
            const isCurrent = index === currentStepIndex;
            const isLocked = index > currentStepIndex + 1;
            
            const statusClass = isCurrent ? 'current' : isCompleted ? 'completed' : isLocked ? 'locked' : 'pending';
            const statusIcon = isCurrent ? '▶' : isCompleted ? '✓' : isLocked ? '🔒' : '○';
            
            const stepType = (step.raw_json ? JSON.parse(step.raw_json) : {}).tpb_step_type || step.step_type || 'CONTENT';
            const typeIcon = getStepTypeIcon(stepType);
            
            html += `
                <div class="step-item ${statusClass}" data-step="${index}" title="${getStepTooltip(statusClass)}">
                    <span class="step-status">${statusIcon}</span>
                    <span class="step-name">${step.name}</span>
                    <span class="step-type-icon">${typeIcon}</span>
                </div>
            `;
        }
    }
    
    html += `</nav>`;
    
    sidebar.innerHTML = html;
};

/**
 * Group steps by section
 * @param {Array} classes - Course classes
 * @returns {Object} - Steps grouped by section name
 */
const groupBySection = (classes) => {
    const groups = {};
    
    for (const cls of classes) {
        const section = (cls.raw_json ? JSON.parse(cls.raw_json) : {}).tpb_section || '';
        
        if (!groups[section]) {
            groups[section] = [];
        }
        groups[section].push(cls);
    }
    
    return groups;
}

/**
 * Get icon for step type
 * @param {string} stepType - Step type
 * @returns {string} - Icon emoji
 */
const getStepTypeIcon = (stepType) => {
    switch (stepType) {
        case 'VIDEO': return '🎬';
        case 'QUIZ': return '📝';
        case 'CONTENT': return '📄';
        case 'MIXED': return '📦';
        default: return '📄';
    }
}

/**
 * Get tooltip text for step status
 * @param {string} status - Status class
 * @returns {string} - Tooltip text
 */
const getStepTooltip = (status) => {
    switch (status) {
        case 'current': return 'Étape en cours';
        case 'completed': return 'Étape terminée';
        case 'locked': return 'Étape verrouillée - Complétez les étapes précédentes';
        case 'pending': return 'Prochaine étape';
        default: return '';
    }
}

/**
 * Update sidebar to reflect current step
 */
export const updateSidebarCurrentStep = () => {
    const currentStepIndex = getState('currentStepIndex');
    
    document.querySelectorAll('.step-item.current').forEach(el => {
        el.classList.remove('current');
        el.classList.add('pending');
        el.querySelector('.step-status').textContent = '○';
    });
    
    const currentItem = document.querySelector(`.step-item[data-step="${currentStepIndex}"]`);
    if (currentItem) {
        currentItem.classList.remove('pending', 'locked');
        currentItem.classList.add('current');
        currentItem.querySelector('.step-status').textContent = '▶';
    }
};

/**
 * Mark a step as completed in the sidebar
 * @param {number} stepIndex - Step index to mark complete
 */
export const markStepComplete = stepIndex => {
    const stepItem = document.querySelector(`.step-item[data-step="${stepIndex}"]`);
    if (stepItem) {
        stepItem.classList.remove('current', 'pending');
        stepItem.classList.add('completed');
        stepItem.querySelector('.step-status').textContent = '✓';
    }
    
    const course = getState('courseData');
    if (course?.classes) {
        const completedCount = document.querySelectorAll('.step-item.completed').length + 1; // +1 for current
        const progressFill = document.querySelector('.sidebar-progress .progress-fill');
        if (progressFill) {
            progressFill.style.width = `${(completedCount / course.classes.length) * 100}%`;
        }
        const progressText = document.querySelector('.sidebar-progress .progress-text');
        if (progressText) {
            progressText.textContent = `${completedCount}/${course.classes.length}`;
        }
    }
};

/**
 * Toggle sidebar visibility (for mobile)
 */
export const toggleSidebar = () => {
    const sidebar = document.getElementById('stepsSidebar');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
    }
};

/**
 * Create sidebar container if it doesn't exist
 */
export const ensureSidebarContainer = () => {
    if (document.getElementById('stepsSidebar')) return;
    
    const container = document.createElement('aside');
    container.id = 'stepsSidebar';
    container.className = 'steps-sidebar';
    
    const main = document.querySelector('.main-content') || document.getElementById('somViewer');
    if (main && main.parentNode) {
        main.parentNode.insertBefore(container, main);
    }
};
