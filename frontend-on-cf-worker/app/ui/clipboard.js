/**
 * Generic "copy plain text to the clipboard" helper — the single authority for text copy
 * across the viewer. Returns true on success, false on failure (never throws), so callers
 * can show a copied/failed affordance without their own try/catch.
 */
export const copyTextToClipboard = async (text) => {
    if (!text) return false;
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
};
