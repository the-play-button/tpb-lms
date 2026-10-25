
export interface ValidatedEvent {
    type: string;
    course_id?: string;
    class_id: string;
    payload?: unknown;
}
