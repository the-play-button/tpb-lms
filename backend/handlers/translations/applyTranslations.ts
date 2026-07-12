/**
 * Apply translations to content object
 * Helper function used by courses handler
 */

type TranslationEntry = { value?: unknown };
type TranslationsByLang = Record<string, Record<string, TranslationEntry>>;

export const applyTranslations = (
    content: Record<string, unknown>,
    translations: TranslationsByLang | null | undefined,
    lang: string,
) => {
    if (!translations || !translations[lang]) return content;

    const langTranslations = translations[lang];
    const result: Record<string, unknown> = { ...content };

    for (const [field, data] of Object.entries(langTranslations)) {
        if (data.value && result[field] !== undefined) {
            result[field] = data.value;
        }
    }

    return result;
};
