import { describe, it, expect, vi } from 'vitest';

// state.js + i18n touch browser globals at import → stub (renderCard is pure).
vi.mock('../state.js', () => ({ getState: () => null, setState: () => {}, subscribe: () => () => {} }));
vi.mock('../../i18n/index.js', () => ({ t: (k) => k }));

import { renderCard } from './classroom.js';

describe('renderCard — classroom course card', () => {
  it('renders a clickable card with course id, title and progress', () => {
    const html = renderCard({
      id: 'pa06-2', title: 'Rédiger des SOMs', description: 'Un cours',
      progress: { progress_percent: 42, course_completed: false },
    });
    expect(html).toContain('class="course-card"');
    expect(html).toContain('data-course="pa06-2"');
    expect(html).toContain('Rédiger des SOMs');
    expect(html).toContain('width: 42%');
    expect(html).toContain('42%');
  });

  it('shows Start when unstarted, Continue when in progress, Review when completed', () => {
    const base = { id: 'c1', title: 'C', description: '' };
    expect(renderCard({ ...base, progress: { progress_percent: 0 } })).toContain('course.start');
    expect(renderCard({ ...base, progress: { progress_percent: 30 } })).toContain('course.continue');
    expect(renderCard({ ...base, progress: { progress_percent: 100, course_completed: true } })).toContain('course.review');
  });

  it('omits the description block when the course has none', () => {
    const html = renderCard({ id: 'c1', title: 'C', progress: { progress_percent: 0 } });
    expect(html).not.toContain('course-card-desc');
  });
});
