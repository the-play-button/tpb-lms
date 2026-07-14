import { VIDEO_PROGRESS_PROJECTION } from '../rules/video_progress.js';
import { QUIZ_RESULT_PROJECTION } from '../rules/quiz_result.js';
import { log } from '@the-play-button/tpb-sdk-js';
import { toError } from '../../utils/toError.js';

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
