// entropy-one-export-per-types-file-ok: cohesive storage wire-shape pair (StorageFile + StoragePermission returned together by the storage port)
/**
 * StorageFile - Represents a file in cloud storage
 *
 * Normalized from the tpb-storage file response.
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
