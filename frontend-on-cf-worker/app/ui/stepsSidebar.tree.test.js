import { describe, it, expect, vi } from 'vitest';

// state.js may touch browser globals at import; stub it (the render helpers take
// ctx explicitly and never call getState).
vi.mock('../state.js', () => ({ getState: () => null, setState: () => {} }));

import { renderNodesTree } from './stepsSidebar.js';

// course.classes = flat DFS-ordered LESSON leaves (what navigation clicks use).
const course = {
  title: 'Nick Saraev — Maker School',
  classes: [{ id: 'les1' }, { id: 'les2' }, { id: 'les3' }],
};
// nodes = SECTION "Month 1" > [ SECTION "Week 1" > les1, les2 ], les3 (top-level)
const nodes = [
  {
    node_kind: 'SECTION', name: 'Month 1', children: [
      { node_kind: 'SECTION', name: 'Week 1', children: [
        { node_kind: 'LESSON', id: 'les1', name: 'Intro' },
      ] },
      { node_kind: 'LESSON', id: 'les2', name: 'Deep dive' },
    ],
  },
  { node_kind: 'LESSON', id: 'les3', name: 'Wrap up' },
];

const ctx = { course, completedSteps: new Set(), currentStepIndex: 0 };

describe('renderNodesTree — nested sections sidebar', () => {
  const html = renderNodesTree(nodes, ctx, 0);

  it('renders SECTION folders at each depth', () => {
    expect(html).toContain('class="section-header"');
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
    // "Month 1"/"Week 1" must not appear inside a step-item (they are folders)
    const stepItems = html.match(/step-item[^>]*>[\s\S]*?<\/div>/g) || [];
    const joined = stepItems.join('');
    expect(joined).not.toContain('Month 1');
    expect(joined).not.toContain('Week 1');
  });
});
