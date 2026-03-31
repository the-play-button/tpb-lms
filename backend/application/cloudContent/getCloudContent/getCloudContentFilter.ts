import { filterFields } from '../../filters/FieldSecurityFilter.js';
import type { GetCloudContentOutput } from './getCloudContentExecute.js';
import type { GetCloudContentContext } from './getCloudContentHydrateContext.js';

/**
 * Filter step: apply field-level security to strip connection details.
 *
 * For getCloudContent the response is the raw content string, so FLS
 * applies to metadata only. We ensure no connection details leak
 * through the response object.
 */
export const getCloudContentFilter = (
  output: GetCloudContentOutput,
  context: GetCloudContentContext,
  viewerEmail: string
): GetCloudContentOutput => {
  const filtered = filterFields(
    output as unknown as Record<string, unknown>,
    viewerEmail,
    context.contentRef.ownerEmail.value
  );
  return {
    content: output.content,
    contentType: output.contentType,
    lang: (filtered as Record<string, unknown>).lang as string | undefined,
  };
};
