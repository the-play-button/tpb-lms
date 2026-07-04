import { describe, it, expect, vi } from 'vitest';

// Keep node-importable: stub the browser-coupled / i18n modules.
vi.mock('../../content/loader/index.js', () => ({ isCloudRef: () => false }));
vi.mock('../../../i18n/index.js', () => ({ t: (k) => k }));
vi.mock('../../log.js', () => ({ log: { debug() {}, info() {}, warn() {}, error() {} } }));

import { extractYoutubeId, getVideoInfo } from './_mediaHelpers.js';
import { parseMediaUrl } from '../../content/loader/parseMediaUrl.js';
import { youtubeProvider } from '../../video/providers/youtubeProvider.js';
import { loomProvider } from '../../video/providers/loomProvider.js';

describe('extractYoutubeId', () => {
  it('parses watch, youtu.be, embed, shorts', () => {
    expect(extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYoutubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYoutubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYoutubeId('https://www.youtube.com/watch?list=x&v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('returns null for non-youtube', () => {
    expect(extractYoutubeId('https://loom.com/share/abc')).toBeNull();
    expect(extractYoutubeId('')).toBeNull();
    expect(extractYoutubeId(null)).toBeNull();
  });
});

describe('parseMediaUrl — video sources', () => {
  it('classifies youtube / loom / tally', () => {
    expect(parseMediaUrl({ url: 'https://youtu.be/dQw4w9WgXcQ', type: 'VIDEO' }).source).toBe('youtube');
    expect(parseMediaUrl({ url: 'https://www.loom.com/share/31225b09888e4b69934765d28a3f5803', type: 'VIDEO' }).source).toBe('loom');
    expect(parseMediaUrl({ url: 'https://tally.so/r/x', type: 'QUIZ' }).source).toBe('tally');
  });
});

describe('getVideoInfo — provider-agnostic shape', () => {
  it('returns the VIDEO media + duration (provider resolved downstream)', () => {
    const cls = { media: [{ url: 'https://youtu.be/dQw4w9WgXcQ', type: 'VIDEO', duration_sec: 120 }] };
    const info = getVideoInfo(cls);
    expect(info.hasVideo).toBe(true);
    expect(info.media.url).toContain('youtu.be');
    expect(info.duration).toBe(120);
  });
  it('hasVideo false when no VIDEO media', () => {
    expect(getVideoInfo({ media: [{ type: 'DOCUMENT', url: 'x' }] }).hasVideo).toBe(false);
  });
});

describe('youtubeProvider', () => {
  it('match extracts the 11-char id', () => {
    expect(youtubeProvider.match({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', type: 'VIDEO' }))
      .toEqual({ providerId: 'youtube', videoId: 'dQw4w9WgXcQ' });
    expect(youtubeProvider.match({ url: 'https://loom.com/share/x', type: 'VIDEO' })).toBeNull();
  });
  it('renderEmbed produces a youtube /embed/ iframe with tracking data attrs', () => {
    const html = youtubeProvider.renderEmbed({ parsed: { videoId: 'dQw4w9WgXcQ' }, stepIndex: 0, courseId: 'c1', classId: 'les1', videoDuration: 300 });
    expect(html).toContain('youtube.com/embed/dQw4w9WgXcQ');
    expect(html).toContain('enablejsapi=1');
    expect(html).toContain('data-provider="youtube"');
    expect(html).toContain('data-youtube-id="dQw4w9WgXcQ"');
    expect(html).toContain('id="video-player-0"');
    expect(html).not.toContain('<video');
  });
});

describe('loomProvider', () => {
  it('match parses share + embed ids', () => {
    expect(loomProvider.match({ url: 'https://www.loom.com/share/31225b09888e4b69934765d28a3f5803', type: 'VIDEO' }))
      .toEqual({ providerId: 'loom', videoId: '31225b09888e4b69934765d28a3f5803' });
    expect(loomProvider.match({ url: 'https://www.loom.com/embed/31225b09888e4b69934765d28a3f5803', type: 'VIDEO' })?.videoId)
      .toBe('31225b09888e4b69934765d28a3f5803');
    expect(loomProvider.match({ url: 'https://youtu.be/x', type: 'VIDEO' })).toBeNull();
  });
  it('renderEmbed produces a loom /embed/ iframe (not a <video>) with tracking data attrs', () => {
    const html = loomProvider.renderEmbed({ parsed: { videoId: '31225b09888e4b69934765d28a3f5803' }, stepIndex: 2, courseId: 'c1', classId: 'les1', videoDuration: 300 });
    expect(html).toContain('loom.com/embed/31225b09888e4b69934765d28a3f5803');
    expect(html).toContain('data-provider="loom"');
    expect(html).toContain('data-loom-id="31225b09888e4b69934765d28a3f5803"');
    expect(html).toContain('id="video-player-2"');
    expect(html).not.toContain('<video');
  });
});
