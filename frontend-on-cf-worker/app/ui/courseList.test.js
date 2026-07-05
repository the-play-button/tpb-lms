import { describe, it, expect, vi } from 'vitest';

// state.js + i18n touch browser globals at import → stub (buildCourseListHtml is pure).
vi.mock('../state.js', () => ({ getState: () => null, subscribe: () => () => {} }));
vi.mock('../../i18n/index.js', () => ({ t: (k) => k }));

import { buildCourseListHtml } from './courseList.js';

const programs = [{ id: 'program_maker-school', name: 'Maker School', course_count: 2 }];
const courses = [
  { id: 'course_a', title: 'Month 1', program_id: 'program_maker-school' },
  { id: 'course_b', title: 'Month 2', program_id: 'program_maker-school' },
  { id: 'pa06-2', title: 'SOMs', program_id: null },
];

describe('buildCourseListHtml — program-aware sidebar (Plan 11)', () => {
  it('groups program courses under a collapsible section, keeps standalone flat', () => {
    const html = buildCourseListHtml(courses, programs, null, new Set());
    expect(html).toContain('class="nav-program"');
    expect(html).toContain('data-program-toggle="program_maker-school"');
    expect(html).toContain('Maker School');
    expect(html).toContain('nav-sublist');
    // program courses appear inside the section
    expect(html).toContain('data-som-id="course_a"');
    expect(html).toContain('data-som-id="course_b"');
    // standalone course present, but NOT wrapped in a program section
    expect(html).toContain('data-som-id="pa06-2"');
  });

  it('marks the section collapsed when its id is in the collapsed set', () => {
    const html = buildCourseListHtml(courses, programs, null, new Set(['program_maker-school']));
    expect(html).toContain('class="nav-program collapsed"');
    expect(html).toContain('aria-expanded="false"');
  });

  it('skips programs that have no courses', () => {
    const html = buildCourseListHtml(
      [{ id: 'pa06-2', title: 'SOMs', program_id: null }],
      [{ id: 'program_empty', name: 'Empty', course_count: 0 }],
      null, new Set(),
    );
    expect(html).not.toContain('nav-program');
    expect(html).toContain('data-som-id="pa06-2"');
  });
});
