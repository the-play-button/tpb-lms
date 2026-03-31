/**
 * Initialize KMS link handling
 * Call this after rendering course content
 */

import { handleKmsLinkClick } from './handleKmsLinkClick.js';

export const initKmsLinks = () => {
    // Use event delegation on the document
    document.addEventListener('click', (event) => {
        const link = event.target.closest('a[href^="/kms/"]');
        if (link) {
            handleKmsLinkClick(event);
        }
    });
};
