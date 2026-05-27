import type { StorageFile } from '../../../types/StorageFile.js';

interface GraphDriveItem {
  id: string;
  name?: string;
  folder?: { childCount?: number };
  file?: { mimeType?: string };
  parentReference?: { id?: string; driveId?: string };
  size?: number;
  webUrl?: string;
  '@microsoft.graph.downloadUrl'?: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
}

const encodeFileId = (drive_id: string, item_id: string): string =>
  btoa(JSON.stringify({ driveId: drive_id, id: item_id }));

export const mapGraphItemToStorageFile = (item: GraphDriveItem): StorageFile => {
  const drive_id = item.parentReference?.driveId; // entropy-optional-chaining-ok: MS Graph parentReference is the contractual access path
  const composite_id = drive_id ? encodeFileId(drive_id, item.id) : item.id;
  const isFolder = Boolean(item.folder);
  return {
    id: composite_id,
    name: item.name ?? '',
    mimeType: isFolder ? 'application/vnd.folder' : (item.file?.mimeType ?? 'application/octet-stream'), // entropy-optional-chaining-ok: MS Graph file facet absent for folders
    size: item.size,
    parentId: item.parentReference?.id, // entropy-optional-chaining-ok: MS Graph parentReference contractual
    createdAt: item.createdDateTime,
    updatedAt: item.lastModifiedDateTime,
    downloadUrl: item['@microsoft.graph.downloadUrl'],
    webUrl: item.webUrl,
  };
};
