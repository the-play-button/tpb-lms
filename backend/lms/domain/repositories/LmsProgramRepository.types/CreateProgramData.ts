export interface CreateProgramData {
  id: string;
  name: string;
  description?: string | null;
  mediaJson?: unknown;
  rawJson?: unknown;
}
