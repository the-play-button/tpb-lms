
export interface ProjectionEvent {
    id?: string;
    type: string;
    user_id?: string;
    course_id?: string;
    class_id?: string;
    payload_json?: unknown;
    [key: string]: unknown;
}
