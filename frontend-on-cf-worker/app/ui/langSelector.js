// entropy-single-export-ok: render + init pattern
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
export const renderLangSelector = () => {
    const currentLang = getLanguage();
    const languages = getSupportedLanguages();
    const current = languages.find(({ code }) => code === currentLang) || languages[0];
    
    return `
        <div class="lang-selector" id="langSelector">
            <button class="lang-btn" id="langBtn" aria-label="Change language" title="Change language">
                <span class="lang-flag">${current.flag}</span>
                <span class="lang-code">${current.code.toUpperCase()}</span>
                <span class="lang-arrow">▼</span>
            </button>
            <div class="lang-dropdown" id="langDropdown">
                ${languages.map(({ code, flag, label }) => `
                    <button class="lang-option ${code === currentLang ? 'active' : ''}" 
                            data-lang="${code}">
                        <span class="lang-flag">${flag}</span>
                        <span class="lang-label">${label}</span>
                        ${code === currentLang ? '<span class="lang-check">✓</span>' : ''}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
};

/**
 * Initialize language selector event handlers
 */
export const initLangSelector = () => {
    const selector = document.getElementById('langSelector');
    if (!selector) return;
    
    const btn = document.getElementById('langBtn');
    const dropdown = document.getElementById('langDropdown');
    
    btn?.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown?.classList.toggle('open');
    });
    
    dropdown?.addEventListener('click', (e) => {
        const option = e.target.closest('.lang-option');
        if (!option) return;
        
        const lang = option.dataset.lang;
        if (lang && lang !== getLanguage()) {
            setLanguage(lang);
            window.location.reload();
        }
        
        dropdown.classList.remove('open');
    });
    
    document.addEventListener('click', (e) => {
        if (!selector.contains(e.target)) {
            dropdown?.classList.remove('open');
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            dropdown?.classList.remove('open');
        }
    });
};
