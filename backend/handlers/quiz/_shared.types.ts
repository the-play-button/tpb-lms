
export interface QuizClassRow {
    id?: string;
    course_id?: string;
    media_json?: string | null;
    raw_json?: string | null;
    [key: string]: unknown;
}
