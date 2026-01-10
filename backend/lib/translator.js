/**
 * Translation Engine
 * 
 * AI-powered translation with glossary support.
 * Uses Claude API for translation with pre/post-processing for business terms.
 */

import { getGlossaryMap } from '../handlers/glossary.js';

/**
 * Detect language of text using simple heuristics
 * @param {string} text - Text to analyze
 * @returns {string} Language code ('fr', 'en', or 'unknown')
 */
export function detectLanguage(text) {
    if (!text || text.length < 10) return 'unknown';
    
    // Common French words/patterns
    const frenchPatterns = /\b(le|la|les|de|du|des|un|une|et|est|sont|pour|dans|avec|sur|vous|nous|cette|ce|votre|notre|qui|que|par)\b/gi;
    
    // Common English words/patterns
    const englishPatterns = /\b(the|a|an|and|is|are|for|in|with|on|you|we|this|your|our|who|that|by|to|of)\b/gi;
    
    const frenchMatches = (text.match(frenchPatterns) || []).length;
    const englishMatches = (text.match(englishPatterns) || []).length;
    
    if (frenchMatches > englishMatches && frenchMatches > 3) return 'fr';
    if (englishMatches > frenchMatches && englishMatches > 3) return 'en';
    
    return 'unknown';
}

/**
 * Pre-process text: Replace glossary terms with placeholders
 * @param {string} text - Text to process
 * @param {Map} glossaryMap - Map of source_term -> target_term
 * @returns {{ text: string, placeholders: Map }} Processed text and placeholder map
 */
function preProcessGlossary(text, glossaryMap) {
    const placeholders = new Map();
    let processedText = text;
    let placeholderIndex = 0;
    
    for (const [sourceTerm, targetTerm] of glossaryMap) {
        // Case-insensitive replacement with word boundaries
        const regex = new RegExp(`\\b${escapeRegex(sourceTerm)}\\b`, 'gi');
        
        processedText = processedText.replace(regex, (match) => {
            const placeholder = `[[GLOSS_${placeholderIndex}]]`;
            placeholders.set(placeholder, { original: match, translation: targetTerm });
            placeholderIndex++;
            return placeholder;
        });
    }
    
    return { text: processedText, placeholders };
}

/**
 * Post-process text: Replace placeholders with translated terms
 * @param {string} text - Translated text with placeholders
 * @param {Map} placeholders - Map of placeholder -> { original, translation }
 * @returns {string} Final translated text
 */
function postProcessGlossary(text, placeholders) {
    let result = text;
    
    for (const [placeholder, { translation }] of placeholders) {
        result = result.replace(new RegExp(escapeRegex(placeholder), 'g'), translation);
    }
    
    return result;
}

/**
 * Escape special regex characters
 */
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Translate text using AI (Claude API)
 * @param {string} text - Text to translate
 * @param {string} sourceLang - Source language code
 * @param {string} targetLang - Target language code
 * @param {string} apiKey - Claude API key
 * @returns {Promise<string>} Translated text
 */
async function callTranslationAPI(text, sourceLang, targetLang, apiKey) {
    const langNames = {
        fr: 'French',
        en: 'English',
        es: 'Spanish',
        de: 'German',
        it: 'Italian',
        pt: 'Portuguese'
    };
    
    const sourceLanguage = langNames[sourceLang] || sourceLang;
    const targetLanguage = langNames[targetLang] || targetLang;
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 4096,
            messages: [{
                role: 'user',
                content: `Translate the following text from ${sourceLanguage} to ${targetLanguage}. 
                
Important rules:
- Preserve all formatting (markdown, HTML, etc.)
- Keep any placeholders like [[GLOSS_0]] exactly as they are
- Maintain the same tone and style
- Do not add explanations, just provide the translation

Text to translate:
${text}`
            }]
        })
    });
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Translation API error: ${response.status} - ${error}`);
    }
    
    const result = await response.json();
    return result.content[0]?.text || '';
}

/**
 * Translate content with glossary support
 * @param {object} options - Translation options
 * @param {string} options.text - Text to translate
 * @param {string} options.sourceLang - Source language code
 * @param {string} options.targetLang - Target language code
 * @param {string} options.orgId - Organization ID for glossary
 * @param {object} options.env - Cloudflare env (for DB access)
 * @param {string} options.apiKey - Claude API key
 * @returns {Promise<string>} Translated text
 */
export async function translate({ text, sourceLang, targetLang, orgId, env, apiKey }) {
    if (!text || text.trim().length === 0) return text;
    if (sourceLang === targetLang) return text;
    
    // 1. Load glossary for this org/language pair
    const glossaryMap = orgId 
        ? await getGlossaryMap(env, orgId, sourceLang, targetLang)
        : new Map();
    
    // 2. Pre-process: Replace glossary terms with placeholders
    const { text: processedText, placeholders } = preProcessGlossary(text, glossaryMap);
    
    // 3. Translate via API
    const translatedText = await callTranslationAPI(processedText, sourceLang, targetLang, apiKey);
    
    // 4. Post-process: Replace placeholders with translated terms
    const finalText = postProcessGlossary(translatedText, placeholders);
    
    return finalText;
}

/**
 * Batch translate multiple fields
 * @param {object} options - Translation options
 * @param {object} options.content - Object with fields to translate
 * @param {string[]} options.fields - Array of field names to translate
 * @param {string} options.sourceLang - Source language code
 * @param {string} options.targetLang - Target language code
 * @param {string} options.orgId - Organization ID for glossary
 * @param {object} options.env - Cloudflare env
 * @param {string} options.apiKey - Claude API key
 * @returns {Promise<object>} Object with translated fields
 */
export async function translateFields({ content, fields, sourceLang, targetLang, orgId, env, apiKey }) {
    const result = {};
    
    for (const field of fields) {
        const value = content[field];
        if (typeof value === 'string' && value.trim().length > 0) {
            result[field] = await translate({
                text: value,
                sourceLang,
                targetLang,
                orgId,
                env,
                apiKey
            });
        }
    }
    
    return result;
}

/**
 * Translate a course and all its classes
 * @param {object} options - Translation options
 * @param {object} options.course - Course object
 * @param {object[]} options.classes - Array of class objects
 * @param {string} options.sourceLang - Source language code
 * @param {string} options.targetLang - Target language code
 * @param {string} options.orgId - Organization ID for glossary
 * @param {object} options.env - Cloudflare env
 * @param {string} options.apiKey - Claude API key
 * @returns {Promise<object>} Object with course and class translations
 */
export async function translateCourse({ course, classes, sourceLang, targetLang, orgId, env, apiKey }) {
    const translations = [];
    
    // Translate course fields
    const courseTranslation = await translateFields({
        content: course,
        fields: ['name', 'description'],
        sourceLang,
        targetLang,
        orgId,
        env,
        apiKey
    });
    
    for (const [field, value] of Object.entries(courseTranslation)) {
        translations.push({
            content_type: 'course',
            content_id: course.id,
            field,
            lang: targetLang,
            value,
            source: 'ai'
        });
    }
    
    // Translate class fields
    for (const cls of classes) {
        const classTranslation = await translateFields({
            content: cls,
            fields: ['name', 'description', 'content_md'],
            sourceLang,
            targetLang,
            orgId,
            env,
            apiKey
        });
        
        for (const [field, value] of Object.entries(classTranslation)) {
            translations.push({
                content_type: 'class',
                content_id: cls.id,
                field,
                lang: targetLang,
                value,
                source: 'ai'
            });
        }
    }
    
    return translations;
}
