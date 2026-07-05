import { describe, it, expect, vi } from 'vitest';

// state.js + i18n touch browser globals at import → stub (buildSidebarTreeHtml is pure).
vi.mock('../state.js', () => ({ getState: () => null, subscribe: () => () => {} }));
vi.mock('../../i18n/index.js', () => ({ t: (k) => k }));

import { buildSidebarTreeHtml } from './sidebar.js';

const programs = [{ id: 'prog_sa', name: 'TPB Sales Academy', course_count: 2 }];
const courses = [
  { id: 'c1', title: 'Vision', program_id: 'prog_sa' },
  { id: 'c2', title: 'Outbound', program_id: 'prog_sa' },
  { id: 'solo', title: 'SOMs', program_id: null },
];

describe('buildSidebarTreeHtml — program-scoped sidebar tree', () => {
  it('root: program picker + standalone course, no program courses, no lessons', () => {
    const html = buildSidebarTreeHtml({ programs, courses, currentProgram: null, currentCourse: null });
    expect(html).toContain('data-open-program="prog_sa"');
    expect(html).toContain('TPB Sales Academy');
    expect(html).toContain('data-open-course="solo"');    // standalone shown at root
    expect(html).not.toContain('data-open-course="c1"');  // program courses NOT flattened at root
    expect(html).not.toContain('steps-list');             // no lessons at root
  });

  it('in a program (no course open): only that program\'s courses + back, nothing else', () => {
    const html = buildSidebarTreeHtml({ programs, courses, currentProgram: 'prog_sa', currentCourse: null });
    expect(html).toContain('data-back-to-classroom');
    expect(html).toContain('TPB Sales Academy');
    expect(html).toContain('data-open-course="c1"');
    expect(html).toContain('data-open-course="c2"');
    expect(html).not.toContain('data-open-program');       // no other-program picker inside a program
    expect(html).not.toContain('data-open-course="solo"'); // standalone not in this program
  });

  it('course open: scoped to its program, the open course expands to its lessons', () => {
    const courseData = {
      title: 'Vision',
      classes: [{ id: 'l1', name: 'Intro' }, { id: 'l2', name: 'Deep dive' }],
      nodes: [
        { node_kind: 'LESSON', id: 'l1', name: 'Intro' },
        { node_kind: 'LESSON', id: 'l2', name: 'Deep dive' },
      ],
    };
    const signals = { can_access_step: 2, steps: [{ class_id: 'l1', step_completed: true }] };
    const html = buildSidebarTreeHtml({
      programs, courses, currentProgram: 'prog_sa', currentCourse: 'c1', courseData, signals, currentStepIndex: 1,
    });
    expect(html).toContain('tree-course expanded');
    expect(html).toContain('steps-list');          // lessons rendered inline
    expect(html).toContain('Intro');
    expect(html).toContain('Deep dive');
    expect(html).toContain('data-open-course="c2"'); // sibling course stays a collapsed row
  });

  it('derives the program scope from the open course when currentProgram is null', () => {
    const html = buildSidebarTreeHtml({
      programs, courses, currentProgram: null, currentCourse: 'c1',
      courseData: { title: 'Vision', classes: [] }, signals: {},
    });
    expect(html).toContain('data-back-to-classroom');
    expect(html).toContain('data-open-course="c2"'); // scoped to prog_sa via c1.program_id
    expect(html).not.toContain('data-open-program');
  });
});
