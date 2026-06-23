/**
 * Filter — applies field-level security via filterFields, then projects
 * to the canonical wire shape via getCloudContentToWire helper (= shape
 * SSOT per ddd_structural_patterns.md § 2.9).
 */
import { filterFields } from '../../../domain/policies/FieldSecurityFilter.js';
import type { GetCloudContentOutput } from './getCloudContentExecute.js';
import type { GetCloudContentContext } from './getCloudContentHydrateContext.js';

/** Named wire-shape projection : canonical CloudContent output. */
const getCloudContentToWire = (
  output: GetCloudContentOutput,
  filtered: Record<string, unknown>,
): GetCloudContentOutput => ({
  content: output.content,
  contentType: output.contentType,
  lang: filtered.lang as string | undefined,
});

export const getCloudContentFilter = (
  output: GetCloudContentOutput,
  context: GetCloudContentContext,
  viewerEmail: string
): GetCloudContentOutput => {
  const { contentRef } = context;
  const filtered = filterFields(
    output as unknown as Record<string, unknown>,
    viewerEmail,
    contentRef.ownerEmail.value
  );
  return getCloudContentToWire(output, filtered as Record<string, unknown>);
};
