import { ServiceUnavailableError } from '../../../../types/errors.js';
import { decodeGraphFileId, graphDrivePath } from './decodeGraphFileId.js';

const GRAPH = 'https://graph.microsoft.com/v1.0';

interface GraphDriveItemMeta {
  '@microsoft.graph.downloadUrl'?: string;
}

export const getGraphFileBinary = async (accessToken: string, fileId: string): Promise<ArrayBuffer> => {
  const { drive_id, item_id } = decodeGraphFileId(fileId);
  const itemPath = `${graphDrivePath(drive_id)}/items/${encodeURIComponent(item_id)}`;

  // Step 1 : get item metadata to retrieve the pre-signed downloadUrl.
  const metaResp = await fetch(`${GRAPH}${itemPath}?select=@microsoft.graph.downloadUrl`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!metaResp.ok) {
    throw new ServiceUnavailableError('Storage', `MS Graph getFile ${metaResp.status}`);
  }
  const meta = (await metaResp.json()) as GraphDriveItemMeta;
  const downloadUrl = meta['@microsoft.graph.downloadUrl'];

  // Step 2 : if downloadUrl provided, fetch it (unauthenticated SAS-style).
  if (downloadUrl) {
    const dl = await fetch(downloadUrl);
    if (!dl.ok) {
      throw new ServiceUnavailableError('Storage', `MS Graph download ${dl.status}`);
    }
    return dl.arrayBuffer();
  }

  // Step 3 : fallback — direct /content endpoint (requires Authorization header).
  const dl = await fetch(`${GRAPH}${itemPath}/content`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!dl.ok) {
    throw new ServiceUnavailableError('Storage', `MS Graph /content ${dl.status}`);
  }
  return dl.arrayBuffer();
};
