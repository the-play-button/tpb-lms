/**
 * Fetch all pages in a KMS space
 */

import { api } from '../../api.js';

/**
 * Fetch all pages in a KMS space
 * @param {string} spaceId - Space ID
 * @returns {Promise<Object>} Space data with pages
 */
export const fetchKmsSpace = async spaceId => {
    const result = await api(`/kms/spaces/${spaceId}`);
    return result.space;
};
