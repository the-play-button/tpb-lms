import { describe, it, expect } from 'vitest';
import { createClassValidateContext } from './createClass/createClassValidateContext.js';
import { updateClassValidateContext } from './updateClass/updateClassValidateContext.js';
import { createClassCheckPolicies } from './createClass/createClassCheckPolicies.js';
import type { AuthoringContext } from '../../types/AuthoringContext.js';

const sectionRow = (over = {}) => ({
  id: 'sec1', course_id: 'c1', parent_class_id: null, node_kind: 'SECTION' as const,
  name: 'Month 1', description: null, media_json: null, sys_order_index: 0, raw_json: null,
  created_at: '', updated_at: '', ...over,
});
const lessonRow = (over = {}) => ({ ...sectionRow(), id: 'les1', node_kind: 'LESSON' as const, name: 'L', ...over });

describe('createClass ValidateContext — tree invariants', () => {
  it('rejects SECTION carrying media', () => {
    const r = createClassValidateContext({
      input: { courseId: 'c1', nodeKind: 'SECTION', name: 'x', mediaJson: [{ url: 'u', type: 'VIDEO' }] },
      course: {} as never, parent: null,
    });
    expect(r.ok).toBe(false);
    expect((r as { error: string }).error).toBe('SECTION_CANNOT_HAVE_MEDIA');
  });

  it('rejects a LESSON parent', () => {
    const r = createClassValidateContext({
      input: { courseId: 'c1', nodeKind: 'LESSON', name: 'x', parentClassId: 'les1' },
      course: {} as never, parent: lessonRow(),
    });
    expect((r as { error: string }).error).toBe('PARENT_MUST_BE_SECTION');
  });

  it('rejects a parent in a different course', () => {
    const r = createClassValidateContext({
      input: { courseId: 'c1', nodeKind: 'LESSON', name: 'x', parentClassId: 'sec1' },
      course: {} as never, parent: sectionRow({ course_id: 'OTHER' }),
    });
    expect((r as { error: string }).error).toBe('PARENT_COURSE_MISMATCH');
  });

  it('accepts a LESSON under a SECTION in the same course', () => {
    const r = createClassValidateContext({
      input: { courseId: 'c1', nodeKind: 'LESSON', name: 'x', parentClassId: 'sec1', mediaJson: [{ url: 'u', type: 'VIDEO' }] },
      course: {} as never, parent: sectionRow(),
    });
    expect(r.ok).toBe(true);
  });
});

describe('updateClass ValidateContext — move invariants + cycle detection', () => {
  it('rejects moving a node under its own descendant (cycle)', () => {
    const r = updateClassValidateContext({
      input: { classId: 'sec1', parentClassId: 'sec1a' },
      current: sectionRow(),
      parent: sectionRow({ id: 'sec1a', parent_class_id: 'sec1' }),
      subtreeIds: ['sec1', 'sec1a', 'les1'], // sec1a is a descendant of sec1
    });
    expect((r as { error: string }).error).toBe('CYCLE_DETECTED');
  });

  it('accepts a legal move under an unrelated SECTION', () => {
    const r = updateClassValidateContext({
      input: { classId: 'les1', parentClassId: 'sec2' },
      current: lessonRow(),
      parent: sectionRow({ id: 'sec2' }),
      subtreeIds: ['les1'],
    });
    expect(r.ok).toBe(true);
  });
});

describe('CheckPolicies — PBAC hasScope gate', () => {
  const ctxWith = (scopes: string[]): AuthoringContext => ({
    db: {} as never,
    actor: { id: 'a', email: 'a@x', type: 'user', bastionUserId: null, scopes, organizationId: null, roles: [] },
    userEmail: 'a@x', courseRepo: {} as never, classRepo: {} as never,
  });

  it('allows when actor holds lms:class:write', () => {
    expect(createClassCheckPolicies(ctxWith(['lms:class:write'])).ok).toBe(true);
  });
  it('forbids when actor lacks the scope', () => {
    const r = createClassCheckPolicies(ctxWith(['lms:course:read']));
    expect(r.ok).toBe(false);
  });
});
