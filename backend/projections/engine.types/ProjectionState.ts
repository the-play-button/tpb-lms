
export interface ProjectionState {
    video_completed?: number;
    quiz_passed?: number;
    video_max_position_sec?: number;
    video_duration_sec?: number;
    video_completed_at?: string | null;
    quiz_score?: number;
    quiz_max_score?: number;
    quiz_passed_at?: string | null;
    [key: string]: unknown;
}
