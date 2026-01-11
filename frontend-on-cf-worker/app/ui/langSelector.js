/**
 * Language Selector Component
 * 
 * Dropdown to switch UI language. Persists to localStorage.
 */

import { getLanguage, setLanguage, getSupportedLanguages } from '../../i18n/index.js';

/**
 * Render language selector dropdown
 * @returns {string} HTML string
 */
export function renderLangSelector() {
    const currentLang = getLanguage();
    const languages = getSupportedLanguages();
    const current = languages.find(l => l.code === currentLang) || languages[0];
    
    return `
        <div class="lang-selector" id="langSelector">
            <button class="lang-btn" id="langBtn" aria-label="Change language" title="Change language">
                <span class="lang-flag">${current.flag}</span>
                <span class="lang-code">${current.code.toUpperCase()}</span>
                <span class="lang-arrow">▼</span>
            </button>
            <div class="lang-dropdown" id="langDropdown">
                ${languages.map(lang => `
                    <button class="lang-option ${lang.code === currentLang ? 'active' : ''}" 
                            data-lang="${lang.code}">
                        <span class="lang-flag">${lang.flag}</span>
                        <span class="lang-label">${lang.label}</span>
                        ${lang.code === currentLang ? '<span class="lang-check">✓</span>' : ''}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Initialize language selector event handlers
 */
export function initLangSelector() {
    const selector = document.getElementById('langSelector');
    if (!selector) return;
    
    const btn = document.getElementById('langBtn');
    const dropdown = document.getElementById('langDropdown');
    
    // Toggle dropdown
    btn?.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown?.classList.toggle('open');
    });
    
    // Handle language selection
    dropdown?.addEventListener('click', (e) => {
        const option = e.target.closest('.lang-option');
        if (!option) return;
        
        const lang = option.dataset.lang;
        if (lang && lang !== getLanguage()) {
            setLanguage(lang);
            // Reload page to apply translations
            window.location.reload();
        }
        
        dropdown.classList.remove('open');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!selector.contains(e.target)) {
            dropdown?.classList.remove('open');
        }
    });
    
    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            dropdown?.classList.remove('open');
        }
    });
}
