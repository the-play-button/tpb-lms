import { ServiceUnavailableError } from '../../../../types/errors.js';

const UNIFIED_API = 'https://api.unified.to';

/**
 * Download file content via Unified.to storage API
 *
 * Returns the raw ArrayBuffer and the content-type from the response.
 *
 * @param accessToken - Unified.to API token
 * @param connectionId - Storage connection ID
 * @param fileId - File to download
 */
export async function downloadFile(
  accessToken: string,
  connectionId: string,
  fileId: string
): Promise<{ content: ArrayBuffer; mimeType: string }> {
  const response = await fetch(
    `${UNIFIED_API}/storage/v1/connection/${connectionId}/file/${fileId}/download`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new ServiceUnavailableError('Storage', 'Download failed');
  }

  const content = await response.arrayBuffer();
  const mimeType = response.headers.get('content-type') ?? 'application/octet-stream';

  return { content, mimeType };
}
