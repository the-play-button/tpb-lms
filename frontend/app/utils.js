/**
 * Utility Functions
 */

/**
 * Format number for display (1000 -> 1k)
 */
export function formatNumber(num) {
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
}

