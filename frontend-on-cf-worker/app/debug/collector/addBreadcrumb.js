/**
 * Add a manual breadcrumb
 */

import { storeBreadcrumb } from './_shared.js';

export const addBreadcrumb = (type, data) => {
    storeBreadcrumb({ type, data });
};
