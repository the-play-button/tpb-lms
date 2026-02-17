// entropy-multiple-exports-ok: cohesive module exports
import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import type { GetCloudPitchContext } from './getCloudPitchHydrateContext.js';
import { contentAccessed } from '../../../domain/events/events/ContentAccessed.js';

export interface GetCloudPitchOutput {
  binary: ArrayBuffer;
  fileName: string;
}

/**
 * Execute step: fetch .pitch binary from cloud storage.
 *
 * - Owner/admin: direct access via storageService.getFileBinary()
 * - Learner: delegated access via pamClient (text proxy, then binary)
 *
 * .pitch files are ZIP-based binaries.
 */
export async function getCloudPitchExecute(
  context: GetCloudPitchContext,
  ctx: HandlerContext
): Promise<Result<string, GetCloudPitchOutput>> {
  const { contentRef, isOwner } = context;
  const connectionId = contentRef.connectionId.value;
  const fileId = contentRef.fileId;

  let binary: ArrayBuffer;

  if (isOwner) {
    binary = await ctx.storageService.getFileBinary(connectionId, fileId);
  } else {
    if (!ctx.pamClient) {
      return fail('PAM service is not available');
    }
    // For binary files via PAM, we get content as base64 string and decode
    const pamResult = await ctx.pamClient.getContent(connectionId, fileId, ctx.userEmail);
    const binaryString = atob(pamResult.content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    binary = bytes.buffer as ArrayBuffer;
  }

  // Emit domain event
  await ctx.domainEvents.publish(
    contentAccessed(contentRef.id.value, ctx.userEmail)
  );

  const fileName = contentRef.name.endsWith('.pitch')
    ? contentRef.name
    : `${contentRef.name}.pitch`;

  return succeed({ binary, fileName });
}
