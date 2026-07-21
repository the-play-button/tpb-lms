/**
 * ConnectionInfo - Represents a cloud storage connection
 *
 * Maps to a native bastion storage connection (resolved by the tpb-storage Worker).
 */
export interface ConnectionInfo {
  id: string;
  integrationType: string;  // e.g. 'onedrive', 'gdrive', 'sharepoint'
  category: string;         // 'storage'
}
