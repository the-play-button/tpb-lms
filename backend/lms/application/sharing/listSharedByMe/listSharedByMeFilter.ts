/**
 * Filter — Régime B : pass-through (no FLS — endpoint scope-restricted via CheckPolicies).
 */
import { filterFields } from '../../../domain/policies/FieldSecurityFilter.js';
import type { SharedByMeEntry } from './listSharedByMeExecute.js';

/**
 * Filter step: apply FLS to listSharedByMe entries.
 * Owner views their own shares — typically a pass-through, but FLS is applied for consistency.
 */
export const listSharedByMeFilter = (entries: SharedByMeEntry[], viewerEmail: string): Partial<SharedByMeEntry>[] => {
  return entries.map((entry) => filterFields(entry, viewerEmail, viewerEmail));
};
