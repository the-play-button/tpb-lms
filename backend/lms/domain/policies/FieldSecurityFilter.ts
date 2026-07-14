/**
 * Filter — Régime B : pass-through (no FLS — endpoint scope-restricted via CheckPolicies).
 */
/**
 * Field-Level Security filter
 * Strips sensitive fields based on viewer's relationship to the data
 */
export const filterFields = <T extends object>(
  data: T,
  viewerEmail: string,
  ownerEmail: string,
  sensitiveFields: string[] = ['connectionId', 'fileId']
): Partial<T> => {
  const filtered = { ...data };
  if (viewerEmail !== ownerEmail) {
    for (const field of sensitiveFields) {
      delete (filtered as Record<string, unknown>)[field];
    }
  }
  return filtered;
};
