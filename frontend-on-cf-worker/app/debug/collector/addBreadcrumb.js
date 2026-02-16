/**
 * Add a manual breadcrumb
 */

import { storeBreadcrumb } from './_shared.js';

export function addBreadcrumb(type, data) {
    storeBreadcrumb({ type, data });
}
