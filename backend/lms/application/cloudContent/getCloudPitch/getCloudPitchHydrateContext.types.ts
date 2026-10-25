import type { ContentRef } from '../../../domain/repositories/ContentRefsRepository.js';

export interface GetCloudPitchContext {
  contentRef: ContentRef;
  isOwner: boolean;
  isEnrolled: boolean;
}
