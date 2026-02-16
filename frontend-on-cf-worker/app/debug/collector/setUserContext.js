/**
 * Set user context (call after authentication)
 */

import { storage } from './_shared.js';

export function setUserContext(user) {
    storage.userContext = {
        email: user?.email || null,
        user_id: user?.id || user?.sub || null,
        contact_id: user?.contact_id || null
    };
}
