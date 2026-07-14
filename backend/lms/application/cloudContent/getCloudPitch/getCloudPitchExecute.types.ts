import { fail, succeed, type Result } from '../../../domain/core/Result.js';
import type { HandlerContext } from '../../../types/HandlerContext.js';
import type { GetCloudPitchContext } from './getCloudPitchHydrateContext.js';
import { contentAccessed } from '../../../domain/events/events/ContentAccessed.js';

export interface GetCloudPitchOutput {
  binary: ArrayBuffer;
  fileName: string;
}
