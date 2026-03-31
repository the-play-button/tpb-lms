/**
 * Fetch a KMS page from the API
 */

import { api } from '../../api.js';

/**
 * Fetch a KMS page from the API
 * @param {string} pageId - Page ID to fetch
 * @returns {Promise<Object>} Page data
 */
export const fetchKmsPage = async pageId => {
    const result = await api(`/kms/pages/${pageId}`);
    return result.page;
};
