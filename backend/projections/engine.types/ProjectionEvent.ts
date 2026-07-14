import { VIDEO_PROGRESS_PROJECTION } from '../rules/video_progress.js';
import { QUIZ_RESULT_PROJECTION } from '../rules/quiz_result.js';
import { log } from '@the-play-button/tpb-sdk-js';
import { toError } from '../../utils/toError.js';

export interface ProjectionEvent {
    id?: string;
    type: string;
    user_id?: string;
    course_id?: string;
    class_id?: string;
    payload_json?: unknown;
    [key: string]: unknown;
}
