import { VIDEO_PROGRESS_PROJECTION } from '../rules/video_progress.js';
import { QUIZ_RESULT_PROJECTION } from '../rules/quiz_result.js';
import { log } from '@the-play-button/tpb-sdk-js';
import { toError } from '../../utils/toError.js';

export interface ProjectionKey { user_id: string; class_id: string; }
