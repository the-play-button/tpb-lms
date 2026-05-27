import { getGraphFileBinary } from './getGraphFileBinary.js';

/**
 * Get text content of a Microsoft Graph file (typically markdown / text).
 * Reuses the binary fetch path then UTF-8 decodes.
 */
export const getGraphFileContent = async (accessToken: string, fileId: string): Promise<string> => {
  const buffer = await getGraphFileBinary(accessToken, fileId);
  return new TextDecoder('utf-8').decode(buffer);
};
