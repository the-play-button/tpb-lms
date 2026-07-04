/**
 * Video provider registry — the hexagonal port's composition root. Order matters:
 * the dedicated hosts (youtube/loom/cloudflare) match first; mp4 is the catch-all
 * for plain VIDEO urls.
 */
import { youtubeProvider } from './youtubeProvider.js';
import { loomProvider } from './loomProvider.js';
import { cloudflareProvider } from './cloudflareProvider.js';
import { mp4Provider } from './mp4Provider.js';

export const VIDEO_PROVIDERS = [youtubeProvider, loomProvider, cloudflareProvider, mp4Provider];

const BY_ID = Object.fromEntries(VIDEO_PROVIDERS.map((p) => [p.id, p]));

/**
 * Resolve the provider for a VIDEO media object.
 * @returns {{ provider: object, parsed: object } | null}
 */
export const resolveProvider = (media) => {
    for (const provider of VIDEO_PROVIDERS) {
        const parsed = provider.match(media);
        if (parsed) return { provider, parsed };
    }
    return null;
};

export const resolveProviderById = (id) => BY_ID[id] ?? null;
