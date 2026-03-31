/**
 * Get document URL from class media
 */

/**
 * Get document URL from class media
 * @param {Object} cls - Class object
 * @returns {string|null} - Document URL or null
 */
export const getDocumentUrl = cls => {
    const media = cls.media || [];
    const docMedia = media.find(({ type }) => type === 'DOCUMENT');
    return docMedia?.url || null;
};
