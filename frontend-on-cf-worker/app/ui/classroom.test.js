import { describe, it, expect, vi } from 'vitest';

// state.js + i18n touch browser globals at import → stub (renderCard is pure).
vi.mock('../state.js', () => ({ getState: () => null, setState: () => {}, subscribe: () => () => {} }));
vi.mock('../../i18n/index.js', () => ({ t: (k) => k }));

import { renderCard, renderProgramCard } from './classroom.js';

describe('renderCard — classroom course card', () => {
  it('renders a clickable card with course id, title and real progress', () => {
    const html = renderCard(
      { id: 'pa06-2', title: 'Rédiger des SOMs', description: 'Un cours' },
      { completed: 6, total: 15, percent: 40 },
    );
    expect(html).toContain('class="course-card"');
    expect(html).toContain('data-course="pa06-2"');
    expect(html).toContain('Rédiger des SOMs');
    expect(html).toContain('width: 40%');
    expect(html).toContain('40%');
  });

  it('shows Start unstarted, Continue in-progress, Review when completed', () => {
    const base = { id: 'c1', title: 'C', description: '' };
    expect(renderCard(base, null)).toContain('course.start');
    expect(renderCard(base, { completed: 2, total: 6, percent: 33 })).toContain('course.continue');
    expect(renderCard(base, { completed: 6, total: 6, percent: 100 })).toContain('course.review');
  });

  it('omits the description block when the course has none', () => {
    const html = renderCard({ id: 'c1', title: 'C' }, null);
    expect(html).not.toContain('course-card-desc');
    expect(html).toContain('width: 0%');
  });

  it('shows the real cover image raw (no scrim, no play icon) when cover_image_url is present', () => {
    const html = renderCard(
      { id: 'c1', title: 'C', cover_image_url: 'https://assets.skool.com/f/abc/cover.jpg' },
      null,
    );
    expect(html).toContain('background-image:');
    // Single-quoted url: it lands inside a double-quoted style="…" attribute, so
    // url("…") would close the attribute early (regression guard, verified live).
    expect(html).toContain("url('https://assets.skool.com/f/abc/cover.jpg')");
    expect(html).not.toContain('url("https://assets.skool.com');
    expect(html).toContain('background-size: cover');
    // No dimming scrim over the cover, no play overlay — the thumbnail reads clean.
    expect(html).not.toContain('rgba(0,0,0');
    expect(html).not.toContain('course-card-play');
    expect(html).not.toContain('▶');
  });

  it('falls back to the deterministic gradient when there is no cover', () => {
    const html = renderCard({ id: 'c1', title: 'C' }, null);
    expect(html).toContain('linear-gradient');
    expect(html).not.toContain('assets.skool.com');
  });
});

describe('renderProgramCard — classroom program card (Plan 10)', () => {
  it('renders a program card with name, cover and course count (not progress)', () => {
    const html = renderProgramCard({
      id: 'program_maker-school', name: 'Maker School', course_count: 11,
      cover_image_url: 'https://assets.skool.com/f/abc/p.jpg',
    });
    expect(html).toContain('class="course-card program-card"');
    expect(html).toContain('data-program="program_maker-school"');
    expect(html).toContain('Maker School');
    expect(html).toContain('11');
    expect(html).toContain("url('https://assets.skool.com/f/abc/p.jpg')");
    // program cards drill into courses — no per-course progress bar / data-course
    expect(html).not.toContain('data-course=');
    expect(html).not.toContain('course-card-progress');
  });
});
