import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { UpdateClassContext } from './updateClassHydrateContext.js';

// Move invariants: new parent must be a SECTION in the same course, and must not
// be the node itself or one of its descendants (no cycle). SECTION + media invalid.
export const updateClassValidateContext = (context: UpdateClassContext): Result<string, void> => {
  const { input, current, parent, subtreeIds } = context;
  const effectiveKind = input.nodeKind ?? current.node_kind;
  const hasMedia = Array.isArray(input.mediaJson) && input.mediaJson.length > 0;
  if (effectiveKind === 'SECTION' && hasMedia) return fail('SECTION_CANNOT_HAVE_MEDIA');
  if (input.parentClassId) {
    if (!parent) return fail('NOT_FOUND');
    if (parent.node_kind !== 'SECTION') return fail('PARENT_MUST_BE_SECTION');
    if (parent.course_id !== current.course_id) return fail('PARENT_COURSE_MISMATCH');
    if (subtreeIds.includes(input.parentClassId)) return fail('CYCLE_DETECTED');
  }
  return succeed(undefined);
};
