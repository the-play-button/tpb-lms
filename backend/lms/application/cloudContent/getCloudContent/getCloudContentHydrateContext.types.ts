import type { ContentRef } from '../../../domain/repositories/ContentRefsRepository.js';

export interface GetCloudContentContext {
  contentRef: ContentRef;
  isOwner: boolean;
  isEnrolled: boolean;
}
