/**
 * Get document URL from class media
 */

/**
 * Get document URL from class media
 * @param {Object} cls - Class object
 * @returns {string|null} - Document URL or null
 */
export function getDocumentUrl(cls) {
    const media = cls.media || [];
    const docMedia = media.find(m => m.type === 'DOCUMENT');
    return docMedia?.url || null;
}
