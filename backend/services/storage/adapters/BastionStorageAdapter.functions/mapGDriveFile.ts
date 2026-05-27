import type { StorageFile } from '../../../types/StorageFile.js';

export interface GDriveFile {
  id: string;
  name?: string;
  mimeType?: string;
  parents?: string[];
  size?: string;
  webViewLink?: string;
  webContentLink?: string;
  createdTime?: string;
  modifiedTime?: string;
}

export const GDRIVE_FIELDS = 'id,name,mimeType,parents,size,webViewLink,webContentLink,createdTime,modifiedTime';

export const mapGDriveFileToStorageFile = (file: GDriveFile, folderMime: string): StorageFile => {
  const isFolder = file.mimeType === folderMime;
  return {
    id: file.id,
    name: file.name ?? '',
    mimeType: isFolder ? 'application/vnd.folder' : (file.mimeType ?? 'application/octet-stream'),
    size: file.size ? Number(file.size) : undefined,
    parentId: file.parents?.[0],
    createdAt: file.createdTime,
    updatedAt: file.modifiedTime,
    downloadUrl: file.webContentLink,
    webUrl: file.webViewLink,
  };
};
