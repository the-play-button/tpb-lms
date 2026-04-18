// entropy-multiple-exports-ok: StorageFile module has 2 tightly-coupled exports sharing internal state
// entropy-god-file-ok: service DTOs — StorageFile + StoragePermission interfaces normalized from Unified.to responses
/**
 * StorageFile - Represents a file in cloud storage
 *
 * Normalized from Unified.to storage file response.
 */
export interface StorageFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  parentId?: string;
  createdAt?: string;
  updatedAt?: string;
  downloadUrl?: string;
  webUrl?: string;
}

/**
 * StoragePermission - Permission on a cloud storage file
 */
export interface StoragePermission {
  id: string;
  fileId: string;
  email: string;
  role: 'READ' | 'WRITE' | 'OWNER';
  grantedAt?: string;
}
