/**
 * VideoProvider — hexagonal port abstracting video hosts (YouTube, Loom, Cloudflare
 * Stream, native mp4). Each adapter owns three concerns for its host:
 *
 *   match(media)            → { providerId, videoId?, url? } | null
 *       Detect + parse a VIDEO media object. Returns null if this provider does
 *       not handle it. `videoId`/`url` are validated here so renderEmbed can trust
 *       them (they are interpolated into iframe src / attributes).
 *
 *   renderEmbed(ctx)        → htmlString
 *       ctx = { parsed, stepIndex, courseId, classId, videoDuration, cls }.
 *       Produces the player markup. The root element MUST carry
 *       id="video-player-<stepIndex>" + data-provider="<id>" so setupVideoTracking
 *       can find + dispatch it.
 *
 *   initTracking(element, hooks) → { destroy() }
 *       hooks = { onEvent(type, positionSec, durationSec), onPing(positionSec, durationSec),
 *                 videoDuration, resumePosition }.
 *       Wire the host's native playback events → hooks. The backend computes step
 *       completion from the emitted pings (coverage) — adapters never decide 90%.
 *
 * @typedef {Object} VideoProvider
 * @property {string} id
 * @property {(media: object) => ({ providerId: string, videoId?: string, url?: string } | null)} match
 * @property {(ctx: object) => string} renderEmbed
 * @property {(element: Element, hooks: object) => ({ destroy: () => void })} initTracking
 */
export {};
