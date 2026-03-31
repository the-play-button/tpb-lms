/**
 * Copy debug info to clipboard
 */

import { gatherDebugInfo } from './gatherDebugInfo.js';

export const copyDebugInfoToClipboard = async () => {
    const info = gatherDebugInfo();
    const json = JSON.stringify(info, null, 2);

    try {
        await navigator.clipboard.writeText(json);
        return { success: true, data: info };
    } catch (error) {
        const textarea = document.createElement('textarea');
        textarea.value = json;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();

        try {
            document.execCommand('copy');
            document.body.removeChild(textarea);
            return { success: true, data: info };
        } catch (e) {
            document.body.removeChild(textarea);
            return { success: false, error: e.message, data: info };
        }
    }
};
