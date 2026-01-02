/**
 * Mastery Badge Component
 * 
 * Display mastery levels based on course progress
 * - None: < 25%
 * - Bronze: 25%+
 * - Silver: 50%+
 * - Gold: 75%+
 * - Master: 100%
 */

const BADGES = {
  none:   { icon: '⚪', label: 'Non commencé', color: '#666' },
  bronze: { icon: '🥉', label: 'Bronze (25%)', color: '#cd7f32' },
  silver: { icon: '🥈', label: 'Argent (50%)', color: '#c0c0c0' },
  gold:   { icon: '🥇', label: 'Or (75%)', color: '#ffd700' },
  master: { icon: '👑', label: 'Maître (100%)', color: '#9b59b6' }
};

/**
 * Render a mastery badge
 * @param {string} level - Mastery level (none, bronze, silver, gold, master)
 * @param {object} options - Optional configuration
 * @param {boolean} options.showLabel - Show label next to icon
 * @param {string} options.size - Size class (small, medium, large)
 * @returns {string} HTML string for the badge
 */
export function renderMasteryBadge(level, options = {}) {
  const badge = BADGES[level] || BADGES.none;
  const showLabel = options.showLabel || false;
  const size = options.size || 'medium';
  
  const sizeClass = `mastery-badge-${size}`;
  
  return `
    <span class="mastery-badge ${sizeClass}" 
          style="color: ${badge.color}" 
          title="${badge.label}"
          data-mastery-level="${level}">
      <span class="mastery-icon">${badge.icon}</span>
      ${showLabel ? `<span class="mastery-label">${badge.label}</span>` : ''}
    </span>
  `;
}

/**
 * Get mastery level from progress percentage
 * @param {number} progressPercent - Progress percentage (0-100)
 * @returns {string} Mastery level
 */
export function getMasteryLevel(progressPercent) {
  if (progressPercent >= 100) return 'master';
  if (progressPercent >= 75) return 'gold';
  if (progressPercent >= 50) return 'silver';
  if (progressPercent >= 25) return 'bronze';
  return 'none';
}

/**
 * Get badge info for a specific level
 * @param {string} level - Mastery level
 * @returns {object} Badge configuration
 */
export function getBadgeInfo(level) {
  return BADGES[level] || BADGES.none;
}

/**
 * Inject mastery badge styles into the document
 * Call this once when loading the page
 */
export function injectMasteryStyles() {
  if (document.getElementById('mastery-badge-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'mastery-badge-styles';
  style.textContent = `
    .mastery-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-weight: 500;
      transition: transform 0.2s ease;
    }
    
    .mastery-badge:hover {
      transform: scale(1.1);
    }
    
    .mastery-badge-small .mastery-icon {
      font-size: 0.875rem;
    }
    
    .mastery-badge-medium .mastery-icon {
      font-size: 1.25rem;
    }
    
    .mastery-badge-large .mastery-icon {
      font-size: 1.75rem;
    }
    
    .mastery-label {
      font-size: 0.875rem;
      opacity: 0.9;
    }
    
    .mastery-progress-bar {
      position: relative;
      height: 0.5rem;
      background: rgba(255,255,255,0.1);
      border-radius: 0.25rem;
      overflow: hidden;
    }
    
    .mastery-progress-fill {
      height: 100%;
      transition: width 0.3s ease, background-color 0.3s ease;
    }
    
    .mastery-progress-fill[data-mastery="none"] {
      background: #666;
    }
    
    .mastery-progress-fill[data-mastery="bronze"] {
      background: linear-gradient(90deg, #cd7f32, #e89850);
    }
    
    .mastery-progress-fill[data-mastery="silver"] {
      background: linear-gradient(90deg, #c0c0c0, #d9d9d9);
    }
    
    .mastery-progress-fill[data-mastery="gold"] {
      background: linear-gradient(90deg, #ffd700, #ffed4e);
    }
    
    .mastery-progress-fill[data-mastery="master"] {
      background: linear-gradient(90deg, #9b59b6, #b370cf);
    }
  `;
  
  document.head.appendChild(style);
}

/**
 * Render mastery progress bar with badge
 * @param {number} progressPercent - Progress percentage
 * @param {object} options - Optional configuration
 * @returns {string} HTML string for progress bar with badge
 */
export function renderMasteryProgress(progressPercent, options = {}) {
  const level = getMasteryLevel(progressPercent);
  const badge = renderMasteryBadge(level, { size: 'small' });
  
  return `
    <div class="mastery-progress-container">
      <div class="mastery-progress-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <span style="font-size: 0.875rem; opacity: 0.8;">${Math.round(progressPercent)}%</span>
        ${badge}
      </div>
      <div class="mastery-progress-bar">
        <div class="mastery-progress-fill" 
             data-mastery="${level}"
             style="width: ${progressPercent}%"></div>
      </div>
    </div>
  `;
}

