/**
 * Parse KMS URL and extract space/page IDs
 */

/**
 * Parse KMS URL and extract space/page IDs
 * @param {string} url - URL like /kms/pa06-references/ref-som-template
 * @returns {{spaceId: string, pageId: string} | null}
 */
export const parseKmsUrl = url => {
    const match = url.match(/^\/kms\/([^/]+)\/([^/]+)$/);
    if (match) {
        return { spaceId: match[1], pageId: match[2] };
    }

    const simpleMatch = url.match(/^\/kms\/([^/]+)$/);
    if (simpleMatch) {
        return { spaceId: null, pageId: simpleMatch[1] };
    }

    return null;
};
