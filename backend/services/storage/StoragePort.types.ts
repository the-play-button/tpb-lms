export interface StoragePort {
  /**
   * Get text content of a file (markdown, etc.)
   * @param connectionId - User's storage connection
   * @param fileId - File to read
   */
  getFileContent(connectionId: string, fileId: string): Promise<string>;

  /**
   * Get binary content of a file (.pitch, .pdf, etc.)
   * @param connectionId - User's storage connection
   * @param fileId - File to read
   */
  getFileBinary(connectionId: string, fileId: string): Promise<ArrayBuffer>;
}
