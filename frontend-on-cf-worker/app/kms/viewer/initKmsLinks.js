/**
 * Initialize KMS link handling
 * Call this after rendering course content
 */

import { handleKmsLinkClick } from './handleKmsLinkClick.js';

export const initKmsLinks = () => {
    document.addEventListener('click', (event) => {
        if (event.target.closest('a[href^="/kms/"]')) {
            handleKmsLinkClick(event);
        }
    });
};
