import { describe, it, expect, vi } from 'vitest';

// state.js + i18n touch browser globals at import → stub (renderCard is pure).
vi.mock('../state.js', () => ({ getState: () => null, setState: () => {}, subscribe: () => () => {} }));
vi.mock('../../i18n/index.js', () => ({ t: (k) => k }));

import { renderCard } from './classroom.js';

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

  it('uses the real cover image (with scrim) when cover_image_url is present', () => {
    const html = renderCard(
      { id: 'c1', title: 'C', cover_image_url: 'https://assets.skool.com/f/abc/cover.jpg' },
      null,
    );
    expect(html).toContain('background-image:');
    expect(html).toContain('url("https://assets.skool.com/f/abc/cover.jpg")');
    expect(html).toContain('background-size: cover');
  });

  it('falls back to the deterministic gradient when there is no cover', () => {
    const html = renderCard({ id: 'c1', title: 'C' }, null);
    expect(html).toContain('linear-gradient');
    expect(html).not.toContain('assets.skool.com');
  });
});
