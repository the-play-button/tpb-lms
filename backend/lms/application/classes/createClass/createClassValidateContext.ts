import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { CreateClassContext } from './createClassHydrateContext.js';

// Tree invariants (actor-independent):
//  - SECTION nodes are pure folders: they must NOT carry media.
//  - A parent must be a SECTION in the SAME course (no LESSON-parent, no cross-course).
export const createClassValidateContext = (context: CreateClassContext): Result<string, void> => {
  const { input, parent } = context;
  const hasMedia = Array.isArray(input.mediaJson) && input.mediaJson.length > 0;
  if (input.nodeKind === 'SECTION' && hasMedia) return fail('SECTION_CANNOT_HAVE_MEDIA');
  if (parent) {
    if (parent.node_kind !== 'SECTION') return fail('PARENT_MUST_BE_SECTION');
    if (parent.course_id !== input.courseId) return fail('PARENT_COURSE_MISMATCH');
  }
  return succeed(undefined);
};
