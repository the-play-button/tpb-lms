export interface CourseRow {
  id: string;
  name: string;
  description: string | null;
  categories_json: string | null;
  media_json: string | null;
  is_active: number;
  is_private: number;
  languages_json: string | null;
  program_id: string | null;
  sys_order_index: number;
  raw_json: string | null;
  created_at: string;
  updated_at: string;
}
