import { describe, it, expect } from 'vitest';
import { createCourseExecute } from '../courses/createCourse/createCourseExecute.js';
import { updateCourseExecute } from '../courses/updateCourse/updateCourseExecute.js';
import { createClassExecute } from './createClass/createClassExecute.js';
import { updateClassExecute } from './updateClass/updateClassExecute.js';
import type { AuthoringContext } from '../../types/AuthoringContext.js';

const actor = { id: 'a', email: 'creator@x', type: 'user' as const, bastionUserId: null, scopes: [], organizationId: null, roles: [] };

const courseRow = (raw: string | null) => ({
  id: 'c1', name: 'C', description: null, categories_json: null, media_json: null,
  is_active: 1, is_private: 0, languages_json: null, raw_json: raw, created_at: '', updated_at: '',
});
const classRow = (raw: string | null) => ({
  id: 'les1', course_id: 'c1', parent_class_id: null, node_kind: 'LESSON' as const, name: 'L',
  description: null, media_json: null, sys_order_index: 0, raw_json: raw, created_at: '', updated_at: '',
});

describe('createCourseExecute — rawJson merge', () => {
  it('merges caller rawJson + progressionMode, always stamps creator last', async () => {
    let inserted: Record<string, unknown> | undefined;
    const ctx = {
      actor,
      courseRepo: { insert: async (d: { rawJson: Record<string, unknown> }) => { inserted = d.rawJson; return courseRow(JSON.stringify(d.rawJson)); } },
    } as unknown as AuthoringContext;
    const r = await createCourseExecute({ input: { name: 'C', progressionMode: 'free', rawJson: { tpb_intro_url: 'https://i' } } } as never, ctx);
    expect(r.ok).toBe(true);
    expect(inserted).toEqual({ tpb_intro_url: 'https://i', tpb_progression_mode: 'free', tpb_created_by: 'creator@x' });
  });

  it('caller rawJson cannot overwrite tpb_created_by', async () => {
    let inserted: Record<string, unknown> | undefined;
    const ctx = {
      actor,
      courseRepo: { insert: async (d: { rawJson: Record<string, unknown> }) => { inserted = d.rawJson; return courseRow(null); } },
    } as unknown as AuthoringContext;
    await createCourseExecute({ input: { name: 'C', rawJson: { tpb_created_by: 'attacker' } } } as never, ctx);
    expect(inserted?.tpb_created_by).toBe('creator@x');
  });
});

describe('updateCourseExecute — read-modify-write merge', () => {
  it('preserves existing raw_json keys and adds progressionMode', async () => {
    let patched: Record<string, unknown> | undefined;
    const ctx = {
      actor,
      courseRepo: {
        findById: async () => courseRow(JSON.stringify({ tpb_created_by: 'orig', keep: 'me' })),
        update: async (_id: string, p: { rawJson?: Record<string, unknown> }) => { patched = p.rawJson; },
      },
    } as unknown as AuthoringContext;
    const r = await updateCourseExecute({ input: { courseId: 'c1', progressionMode: 'free' } } as never, ctx);
    expect(r.ok).toBe(true);
    expect(patched).toEqual({ tpb_created_by: 'orig', keep: 'me', tpb_progression_mode: 'free' });
  });

  it('leaves raw_json untouched when neither rawJson nor progressionMode provided', async () => {
    let patched: { rawJson?: unknown } = {};
    const ctx = {
      actor,
      courseRepo: {
        findById: async () => courseRow(JSON.stringify({ a: 1 })),
        update: async (_id: string, p: { rawJson?: unknown }) => { patched = p; },
      },
    } as unknown as AuthoringContext;
    await updateCourseExecute({ input: { courseId: 'c1', name: 'renamed' } } as never, ctx);
    expect(patched.rawJson).toBeUndefined();
  });
});

describe('createClassExecute — content routed to raw_json (not deprecated columns)', () => {
  it('stores contentMd + stepType in raw_json, never as columns', async () => {
    let inserted: Record<string, unknown> = {};
    const ctx = {
      actor,
      classRepo: { insert: async (d: Record<string, unknown>) => { inserted = d; return classRow(JSON.stringify(d.rawJson)); } },
    } as unknown as AuthoringContext;
    const r = await createClassExecute({ input: { courseId: 'c1', nodeKind: 'LESSON', name: 'L', contentMd: '# hi', stepType: 'CONTENT' } } as never, ctx);
    expect(r.ok).toBe(true);
    expect(inserted.rawJson).toEqual({ tpb_step_type: 'CONTENT', tpb_content_md: '# hi', tpb_created_by: 'creator@x' });
    expect(inserted.contentMd).toBeUndefined();
    expect(inserted.stepType).toBeUndefined();
  });
});

describe('updateClassExecute — read-modify-write merge for inline content', () => {
  it('preserves existing raw_json keys and adds tpb_content_md', async () => {
    let patched: Record<string, unknown> | undefined;
    const ctx = {
      actor,
      classRepo: {
        findById: async () => classRow(JSON.stringify({ tpb_created_by: 'orig', tpb_step_type: 'VIDEO' })),
        update: async (_id: string, p: { rawJson?: Record<string, unknown> }) => { patched = p.rawJson; },
      },
    } as unknown as AuthoringContext;
    const r = await updateClassExecute({ input: { classId: 'les1', contentMd: 'new body' } } as never, ctx);
    expect(r.ok).toBe(true);
    expect(patched).toEqual({ tpb_created_by: 'orig', tpb_step_type: 'VIDEO', tpb_content_md: 'new body' });
  });
});
