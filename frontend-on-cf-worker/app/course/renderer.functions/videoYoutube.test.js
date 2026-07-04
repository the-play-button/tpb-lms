import { describe, it, expect, vi } from 'vitest';

// _mediaHelpers imports isCloudRef from the loader barrel, which pulls
// browser-only modules (fetch/DOM). Mock it so the pure helpers load in node.
vi.mock('../../content/loader/index.js', () => ({ isCloudRef: () => false }));
// videoSection imports i18n, which calls initLanguage() at module load (touches
// localStorage). Stub it so the render helpers load in node.
vi.mock('../../../i18n/index.js', () => ({ t: (k) => k }));

import { extractYoutubeId, getVideoInfo } from './_mediaHelpers.js';
import { renderVideoSection } from './videoSection.js';
import { parseMediaUrl } from '../../content/loader/parseMediaUrl.js';

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

describe('parseMediaUrl — youtube source', () => {
  it('classifies a youtube url as VIDEO/source=youtube', () => {
    const r = parseMediaUrl({ url: 'https://youtu.be/dQw4w9WgXcQ', type: 'VIDEO' });
    expect(r.type).toBe('VIDEO');
    expect(r.source).toBe('youtube');
  });
});

describe('getVideoInfo — youtube media', () => {
  it('extracts youtubeId from media_json url and does NOT set videoUrl', () => {
    const cls = { media: [{ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', type: 'VIDEO', name: 'v' }] };
    const info = getVideoInfo(cls);
    expect(info.hasVideo).toBe(true);
    expect(info.youtubeId).toBe('dQw4w9WgXcQ');
    expect(info.videoUrl).toBeNull(); // must not flow into a native <video src>
  });
  it('keeps a plain mp4 as videoUrl (no youtubeId)', () => {
    const cls = { media: [{ url: 'https://cdn.example.com/a.mp4', type: 'VIDEO' }] };
    const info = getVideoInfo(cls);
    expect(info.youtubeId).toBeNull();
    expect(info.videoUrl).toBe('https://cdn.example.com/a.mp4');
  });
});

describe('renderVideoSection — youtube branch', () => {
  it('renders a youtube /embed/ iframe (not a <video>) with tracking data attrs', () => {
    const html = renderVideoSection({
      cls: { id: 'les1' }, stepIndex: 0, currentCourse: 'c1',
      videoId: null, videoYoutubeId: 'dQw4w9WgXcQ', videoUrl: null,
      videoDuration: 300, quizPassed: false, hasQuiz: false,
    });
    expect(html).toContain('youtube.com/embed/dQw4w9WgXcQ');
    expect(html).toContain('enablejsapi=1');
    expect(html).toContain('data-youtube-id="dQw4w9WgXcQ"');
    expect(html).not.toContain('<video');
  });
});
