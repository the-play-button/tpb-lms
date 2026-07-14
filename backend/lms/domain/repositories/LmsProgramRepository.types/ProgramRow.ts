export interface ProgramRow {
  id: string;
  name: string;
  description: string | null;
  media_json: string | null;
  is_active: number;
  raw_json: string | null;
  created_at: string;
  updated_at: string;
}
