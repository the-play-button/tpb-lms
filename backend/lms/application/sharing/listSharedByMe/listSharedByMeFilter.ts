/**
 * Filter — Régime B : pass-through (no FLS — endpoint scope-restricted via CheckPolicies).
 */
import { filterFields } from '../../../domain/policies/FieldSecurityFilter.js';
import type { SharedByMeEntry } from './listSharedByMeExecute.js';

/**
 * Filter step: apply FLS to listSharedByMe entries.
 * Owner views their own shares — typically a pass-through, but FLS is applied for consistency.
 */
export const listSharedByMeFilter = (entries: SharedByMeEntry[], viewerEmail: string): SharedByMeEntry[] => {
  return entries.map((entry) =>
    filterFields(
      entry as unknown as Record<string, unknown>,
      viewerEmail,
      viewerEmail
    ) as unknown as SharedByMeEntry
  );
};
