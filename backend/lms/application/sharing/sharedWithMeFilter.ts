/**
 * Filter — Régime B : pass-through (no FLS — endpoint scope-restricted via CheckPolicies).
 */
import { filterFields } from '../../domain/policies/FieldSecurityFilter.js';
import type { SharedWithMeEntry } from './sharedWithMeExecute.js';

/**
 * Filter step: apply FLS to sharedWithMe entries.
 * Viewer sees content shared by others — strip sensitive fields from non-owner entries.
 */
export const sharedWithMeFilter = (entries: SharedWithMeEntry[], viewerEmail: string): SharedWithMeEntry[] => {
  return entries.map((entry) =>
    filterFields(
      entry as unknown as Record<string, unknown>,
      viewerEmail,
      entry.shared_by
    ) as unknown as SharedWithMeEntry
  );
};
