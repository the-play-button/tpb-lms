// entropy-unused-export-ok: hasTranslation available for external consumers
// entropy-legacy-marker-ok: debt — no legacy markers found, ACK retained for header completeness
/**
 * i18n Module - Internationalization for LMS UI
 * 
 * Usage:
 *   import { t, setLanguage, getLanguage, getSupportedLanguages } from '../i18n/index.js';
 *   
 *   // Get translation
 *   t('nav.next') // => "Suivant" or "Next"
 *   
 *   // With interpolation
 *   t('course.step', { num: 1, total: 5 }) // => "Étape 1 / 5"
 *   
 *   // Change language
 *   setLanguage('en');
 */

import { log } from '../app/log.js';
import fr from './fr.json' with { type: 'json' };
import en from './en.json' with { type: 'json' };
import de from './de.json' with { type: 'json' };
import it from './it.json' with { type: 'json' };
import ja from './ja.json' with { type: 'json' };
import zh from './zh.json' with { type: 'json' };

const translations = { fr, en, de, it, ja, zh };

const SUPPORTED_LANGUAGES = ['fr', 'en', 'de', 'it', 'ja', 'zh'];
const DEFAULT_LANGUAGE = 'fr';
const STORAGE_KEY = 'lms-lang';

let currentLang = DEFAULT_LANGUAGE;

/**
 * Initialize language from storage or browser preference
 */
export const initLanguage = () => {
    // 1. Check localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.includes(stored)) {
        currentLang = stored;
        return currentLang;
    }
    
    // 2. Check browser language
    const browserLang = navigator.language?.split('-')[0];
    if (browserLang && SUPPORTED_LANGUAGES.includes(browserLang)) {
        currentLang = browserLang;
        localStorage.setItem(STORAGE_KEY, currentLang);
        return currentLang;
    }
    
    // 3. Default to French
    currentLang = DEFAULT_LANGUAGE;
    return currentLang;
};

/**
 * Get current language
 */
export const getLanguage = () => {
    return currentLang;
};

/**
 * Set language and persist to storage
 */
export const setLanguage = lang => {
    if (!SUPPORTED_LANGUAGES.includes(lang)) {
        log.warn(`[i18n] Unsupported language: ${lang}`);
        return false;
    }
    
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    
    window.dispatchEvent(new CustomEvent('languagechange', { detail: { lang } }));
    
    return true;
};

/**
 * Get list of supported languages with labels
 */
export const getSupportedLanguages = () => {
    return [
        { code: 'fr', label: 'Français', flag: '🇫🇷' },
        { code: 'en', label: 'English', flag: '🇬🇧' },
        { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
        { code: 'it', label: 'Italiano', flag: '🇮🇹' },
        { code: 'ja', label: '日本語', flag: '🇯🇵' },
        { code: 'zh', label: '中文', flag: '🇨🇳' }
    ];
};

const getNestedValue = (obj, path) => {
    return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
};

/**
 * Translate a key
 * @param {string} key - Translation key (e.g., "nav.next")
 * @param {object} params - Interpolation parameters
 * @returns {string} Translated string or key if not found
 */
export const t = (key, params = {}) => {
    const langData = translations[currentLang] || translations[DEFAULT_LANGUAGE];
    let value = getNestedValue(langData, key);
    
    if (value === undefined && currentLang !== DEFAULT_LANGUAGE) {
        value = getNestedValue(translations[DEFAULT_LANGUAGE], key);
    }
    
    if (value === undefined) {
        log.warn(`[i18n] Missing translation: ${key}`);
        return key;
    }
    
    if (typeof value === 'string' && Object.keys(params).length > 0) {
        Object.entries(params).forEach(([paramKey, paramValue]) => {
            value = value.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), paramValue);
        });
    }
    
    return value;
};

/**
 * Check if a translation key exists
 */
export const hasTranslation = key => {
    const langData = translations[currentLang] || translations[DEFAULT_LANGUAGE];
    return getNestedValue(langData, key) !== undefined;
};

initLanguage();

if (typeof window !== 'undefined') {
    window.i18n = { t, setLanguage, getLanguage, getSupportedLanguages, initLanguage }; // entropy-global-pollution-ok: intentional global for non-module scripts // entropy-orphan-global-ok: inline assignment
}
