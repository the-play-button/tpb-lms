// entropy-multiple-exports-ok: cohesive module exports
import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import type { GetCloudContentContext } from './getCloudContentHydrateContext.js';
import { contentAccessed } from '../../../domain/events/events/ContentAccessed.js';

export interface GetCloudContentOutput {
  content: string;
  contentType: string;
  lang?: string;
}

/**
 * Execute step: fetch content from cloud storage.
 *
 * - Owner/admin: direct access via storageService
 * - Learner: delegated access via pamClient
 */
export const getCloudContentExecute = async (context: GetCloudContentContext, ctx: HandlerContext): Promise<Result<string, GetCloudContentOutput>> => {
  const { contentRef, isOwner } = context;
  const connectionId = contentRef.connectionId.value;
  const fileId = contentRef.fileId;

  let content: string;

  if (isOwner) {
    content = await ctx.storageService.getFileContent(connectionId, fileId);
  } else {
    if (!ctx.pamClient) {
      return fail('PAM service is not available');
    }
    const pamResult = await ctx.pamClient.getContent(connectionId, fileId, ctx.userEmail);
    content = pamResult.content;
  }

  await ctx.domainEvents.publish(
    contentAccessed(contentRef.id.value, ctx.userEmail)
  );

  const contentType = contentRef.contentType === 'markdown'
    ? 'text/markdown; charset=utf-8'
    : contentRef.contentType === 'pdf'
      ? 'application/pdf'
      : 'application/octet-stream';

  return succeed({
    content,
    contentType,
    lang: contentRef.lang,
  });
};
