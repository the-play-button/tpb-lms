/**
 * Safe DOM helpers — escape interpolated values when assembling HTML.
 *
 * Use the `safeHtml` tagged template literal (= auto-escapes interpolated values).
 *   safeHtml`<li>${course.title}</li>`  // course.title is HTML-escaped
 *
 * For trusted nested HTML (already-safe-by-construction), wrap with `raw()`.
 *   safeHtml`<div>${raw(precomputedMasteryBadge)}</div>`
 *
 * For DOM assignment use `setSafeHtml(el, htmlString)` which goes through
 * a single chokepoint (= easier audit + future DOMPurify wiring).
 */

const _ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '`': '&#96;',
};

const _RAW_MARKER = Symbol('safe-dom-raw');

export const escapeHtml = (value) => {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"'`]/g, (ch) => _ESCAPE_MAP[ch]);
};

/**
 * Wrap an already-safe HTML fragment so the `safeHtml` tag skips escaping it.
 * Use sparingly — every `raw(...)` call is an audit point.
 */
export const raw = (htmlFragment) => {
    return { [_RAW_MARKER]: true, html: String(htmlFragment) };
};

/**
 * Tagged template literal that escapes interpolated values by default.
 * Pass `raw(...)` to opt out for a specific interpolation site.
 */
export const safeHtml = (strings, ...values) => {
    let out = strings[0];
    for (let i = 0; i < values.length; i += 1) {
        const v = values[i];
        if (v !== null && typeof v === 'object' && v[_RAW_MARKER] === true) {
            out += v.html;
        } else {
            out += escapeHtml(v);
        }
        out += strings[i + 1];
    }
    return out;
};

/**
 * Single chokepoint for setting innerHTML. Future: route through DOMPurify
 * for an additional sanitization layer.
 */
export const setSafeHtml = (element, htmlString) => {
    if (!element) return;
    element.innerHTML = htmlString;
};

/**
 * Single chokepoint for replacing an entire element with new HTML (outerHTML).
 * Used by re-render-in-place patterns (= replace `.quiz-locked` block with
 * unlocked variant) so the surrounding code stays free of raw `outerHTML =`.
 */
export const setSafeOuterHtml = (element, htmlString) => {
    if (!element) return;
    element.outerHTML = htmlString;
};
