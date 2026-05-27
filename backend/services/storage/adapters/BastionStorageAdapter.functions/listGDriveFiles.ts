import type { StorageFile } from '../../../types/StorageFile.js';
import { ServiceUnavailableError } from '../../../../types/errors.js';
import { mapGDriveFileToStorageFile, GDRIVE_FIELDS, type GDriveFile } from './mapGDriveFile.js';

const GDRIVE_API = 'https://www.googleapis.com/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

interface GDriveListResponse {
  files: GDriveFile[];
  nextPageToken?: string;
}

export const listFiles = async (accessToken: string, parentId?: string): Promise<StorageFile[]> => {
  const qParts: string[] = ['trashed = false'];
  if (parentId) qParts.push(`'${parentId}' in parents`);

  const params = new URLSearchParams();
  params.set('q', qParts.join(' and '));
  params.set('fields', `files(${GDRIVE_FIELDS})`);

  const response = await fetch(`${GDRIVE_API}/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new ServiceUnavailableError('Storage', `GDrive listFiles ${response.status}`);
  }
  const data = (await response.json()) as GDriveListResponse;
  if (!Array.isArray(data.files)) {
    throw new ServiceUnavailableError('Storage', `GDrive listFiles malformed response — missing 'files' array`);
  }
  return data.files.map((f) => mapGDriveFileToStorageFile(f, FOLDER_MIME));
};
