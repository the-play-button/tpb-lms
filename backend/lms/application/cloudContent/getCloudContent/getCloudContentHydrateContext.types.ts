import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { ContentRef } from '../../../domain/repositories/ContentRefsRepository.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { ContentRefId } from '../../../domain/value-objects/index.js';
import type { GetCloudContentInput } from './getCloudContentValidateInput.js';

export interface GetCloudContentContext {
  contentRef: ContentRef;
  isOwner: boolean;
  isEnrolled: boolean;
}
