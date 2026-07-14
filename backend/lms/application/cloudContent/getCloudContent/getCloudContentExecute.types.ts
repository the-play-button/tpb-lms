import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import type { GetCloudContentContext } from './getCloudContentHydrateContext.js';
import { contentAccessed } from '../../../domain/events/events/ContentAccessed.js';

export interface GetCloudContentOutput {
  content: string;
  contentType: string;
  lang?: string;
}
