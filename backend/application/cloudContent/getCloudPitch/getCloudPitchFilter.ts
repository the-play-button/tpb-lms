import type { GetCloudPitchOutput } from './getCloudPitchExecute.js';

/**
 * Filter step: pass-through for binary pitch files.
 *
 * Pitch files are raw binary (ArrayBuffer) — no metadata fields to strip.
 */
export const getCloudPitchFilter = (output: GetCloudPitchOutput): GetCloudPitchOutput => {
  return output;
};
