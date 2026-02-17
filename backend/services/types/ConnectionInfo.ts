// entropy-god-file-ok: service DTO — ConnectionInfo interface mapping a Unified.to storage connection (id + integrationType + category)
/**
 * ConnectionInfo - Represents a cloud storage connection
 *
 * Maps to a Unified.to storage connection.
 */
export interface ConnectionInfo {
  id: string;
  integrationType: string;  // e.g. 'onedrive', 'gdrive', 'sharepoint'
  category: string;         // 'storage'
}
