import { describe, it, expect, vi } from 'vitest';

// state.js may touch browser globals at import; stub it (the render helpers take
// ctx explicitly and never call getState).
vi.mock('../state.js', () => ({ getState: () => null, setState: () => {}, subscribe: () => () => {} }));
// i18n calls initLanguage() (localStorage) at module load — stub so the module
// imports in node. Tooltips/aria return their key, which is fine for assertions.
vi.mock('../../i18n/index.js', () => ({ t: (k) => k }));

import { renderNodesTree, renderLessonItem } from './stepsSidebar.js';

// course.classes = flat DFS-ordered LESSON leaves (what navigation clicks use).
const course = {
  title: 'Nick Saraev — Maker School',
  classes: [{ id: 'les1' }, { id: 'les2' }, { id: 'les3' }],
};
// nodes = SECTION "Month 1" > [ SECTION "Week 1" > les1, les2 ], les3 (top-level)
const nodes = [
  {
    node_kind: 'SECTION', id: 'sec-m1', name: 'Month 1', children: [
      { node_kind: 'SECTION', id: 'sec-w1', name: 'Week 1', children: [
        { node_kind: 'LESSON', id: 'les1', name: 'Intro' },
      ] },
      { node_kind: 'LESSON', id: 'les2', name: 'Deep dive' },
    ],
  },
  { node_kind: 'LESSON', id: 'les3', name: 'Wrap up' },
];

// currentStepIndex 0 + maxAccessibleIndex 1 → les1/les2 accessible, les3 locked.
const ctx = { course, completedSteps: new Set(), currentStepIndex: 0, maxAccessibleIndex: 1 };

describe('renderNodesTree — nested sections sidebar', () => {
  const html = renderNodesTree(nodes, ctx, 0);

  it('renders collapsible SECTION folders at each depth', () => {
    expect(html).toContain('class="section-header"');
    expect(html).toContain('class="section-group"');
    expect(html).toContain('class="section-children"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('data-section-id="sec-m1"');
    expect(html).toContain('Month 1');
    expect(html).toContain('Week 1');
  });

  it('maps LESSON leaves to their flat course.classes index (data-step)', () => {
    expect(html).toContain('data-step="0"'); // les1
    expect(html).toContain('data-step="1"'); // les2
    expect(html).toContain('data-step="2"'); // les3
    expect(html).toContain('Intro');
    expect(html).toContain('Deep dive');
    expect(html).toContain('Wrap up');
  });

  it('indents deeper nodes more (padding-left grows with depth)', () => {
    // depth 0 section = 8px, depth 1 section = 22px
    expect(html).toContain('padding-left:8px');
    expect(html).toContain('padding-left:22px');
  });

  it('renders SECTION nodes as headers, not clickable steps', () => {
    const stepItems = html.match(/step-item[^>]*>[\s\S]*?<\/div>/g) || [];
    const joined = stepItems.join('');
    expect(joined).not.toContain('Month 1');
    expect(joined).not.toContain('Week 1');
  });
});

describe('renderLessonItem — accessibility gating', () => {
  it('marks accessible non-current lessons clickable', () => {
    // les2 = index 1, accessible (<= maxAccessibleIndex 1), not current
    const html = renderLessonItem({ id: 'les2', name: 'Deep dive' }, ctx, 0);
    expect(html).toContain('clickable');
    expect(html).toContain('data-step="1"');
  });

  it('does not mark the current lesson clickable', () => {
    // les1 = index 0 = currentStepIndex
    const html = renderLessonItem({ id: 'les1', name: 'Intro' }, ctx, 0);
    expect(html).not.toContain('clickable');
    expect(html).toContain('step-item current');
  });

  it('locks lessons beyond the access ceiling (no clickable)', () => {
    // les3 = index 2 > maxAccessibleIndex 1 → locked
    const html = renderLessonItem({ id: 'les3', name: 'Wrap up' }, ctx, 0);
    expect(html).toContain('locked');
    expect(html).not.toContain('clickable');
  });
});
