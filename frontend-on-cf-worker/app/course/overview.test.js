import { describe, it, expect, vi } from 'vitest';

// overview.js pulls heavy browser-coupled modules at import — stub them so the
// pure renderPrimaryCta can be exercised in node. safe-dom is pure (kept real).
vi.mock('../api.js', () => ({ api: vi.fn(), apiPost: vi.fn(), apiPatch: vi.fn() }));
vi.mock('../state.js', () => ({ getState: () => null, setState: () => {} }));
vi.mock('../log.js', () => ({ log: { warn: vi.fn(), error: vi.fn() } }));
vi.mock('../content/loader/index.js', () => ({ fetchMarkdown: vi.fn(), fetchCloudContent: vi.fn() }));
vi.mock('../content/loader/_shared.js', () => ({ stripFrontmatter: (x) => x, cleanMarkdownForLms: (x) => x }));
vi.mock('./loader.js', () => ({ loadCourse: vi.fn(), resumeStepIndex: vi.fn(() => 0) }));
vi.mock('../../i18n/index.js', () => ({ t: (k) => k, getLanguage: () => 'fr' }));

import { renderPrimaryCta } from './overview.js';

describe('renderPrimaryCta — progression-driven (not enrollment)', () => {
  it('Start at 0 progress, always opens the course', () => {
    const html = renderPrimaryCta({ id: 'c1', progress: { completed_steps: 0, total_steps: 6 } });
    expect(html).toContain('data-action="open"');
    expect(html).toContain('data-course="c1"');
    expect(html).toContain('course.start');
    expect(html).not.toContain('course.continue');
  });

  it('Continue with percent when partially done', () => {
    const html = renderPrimaryCta({ id: 'c1', progress: { completed_steps: 1, total_steps: 6 } });
    expect(html).toContain('course.continue');
    expect(html).toContain('(17%)');
  });

  it('Review when fully complete', () => {
    const html = renderPrimaryCta({ id: 'c1', progress: { completed_steps: 6, total_steps: 6 } });
    expect(html).toContain('course.review');
  });

  it('Start (no crash) when progress is missing', () => {
    const html = renderPrimaryCta({ id: 'c1' });
    expect(html).toContain('course.start');
    expect(html).toContain('data-action="open"');
  });
});
