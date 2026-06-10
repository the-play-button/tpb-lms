/**
 * Apply translations to content object
 * Helper function used by courses handler
 */

export const applyTranslations = (content, translations, lang) => {
    if (!translations || !translations[lang]) return content;

    const langTranslations = translations[lang];
    const result = { ...content };

    for (const [field, data] of Object.entries(langTranslations)) {
        if (data.value && result[field] !== undefined) {
            result[field] = data.value;
        }
    }

    return result;
};
