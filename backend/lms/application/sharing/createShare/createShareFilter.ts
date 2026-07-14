/**
 * Filter — Régime B : pass-through (no FLS — endpoint scope-restricted via CheckPolicies).
 */
import { filterFields } from '../../../domain/policies/FieldSecurityFilter.js';
import type { ShareContentOutput } from './createShareExecute.js';

/**
 * Filter step: apply FLS to share response.
 * Strip internal IDs from non-owner viewers.
 */
export const createShareFilter = (output: ShareContentOutput, viewerEmail: string, ownerEmail: string): Partial<ShareContentOutput> => {
  return filterFields(output, viewerEmail, ownerEmail, ['connectionId', 'fileId']);
};
