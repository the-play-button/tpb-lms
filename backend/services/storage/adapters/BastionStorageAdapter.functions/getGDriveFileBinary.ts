import { ServiceUnavailableError } from '../../../../types/errors.js';

const GDRIVE_API = 'https://www.googleapis.com/drive/v3';

export const getGDriveFileBinary = async (accessToken: string, fileId: string): Promise<ArrayBuffer> => {
  const response = await fetch(
    `${GDRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) {
    throw new ServiceUnavailableError('Storage', `GDrive download ${response.status}`);
  }
  return response.arrayBuffer();
};
