import { getGDriveFileBinary } from './getGDriveFileBinary.js';

export const getGDriveFileContent = async (accessToken: string, fileId: string): Promise<string> => {
  const buffer = await getGDriveFileBinary(accessToken, fileId);
  return new TextDecoder('utf-8').decode(buffer);
};
