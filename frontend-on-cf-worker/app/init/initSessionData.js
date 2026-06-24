/**
 * Session data init — fetches session + courses + badges, populates state.
 * Returns the courses list so the caller can pick the initial course.
 */
import { setState } from '../state.js';
import { api } from '../api.js';
import { log } from '../log.js';
import { setUserContext } from '../debug/collector/index.js';

export const initSessionData = async (lang) => {
    // 1. Session from API
    const session = await api('/auth/session');
    setState('user', session.user);
    setState('profile', session.profile);
    setState('badges', session.badges || []);

    // Don't pass full email to the log — emit only opaque marker. The user
    // identity is already in Sentry context below (= structured user obj),
    // not in plaintext browser console. Per bearer:javascript-lang-logger.
    log.info('🔐 Session loaded');

    if (window.Sentry) {
        window.Sentry.setUser({
            id: session.profile?.contact_id || session.user.id,
            email: session.user.email
        });
    }

    setUserContext({
        email: session.user.email,
        id: session.user.id,
        contact_id: session.profile?.contact_id
    });

    // 2. Available courses (with language for translations)
    const { courses } = await api(`/courses?lang=${lang}`);
    setState('courses', courses);

    // 3. All badge definitions
    const badgeData = await api('/badges');
    setState('allBadges', badgeData.badges || []);

    return { session, courses };
};
