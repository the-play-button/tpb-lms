import { VIDEO_PROGRESS_PROJECTION } from '../rules/video_progress.js';
import { QUIZ_RESULT_PROJECTION } from '../rules/quiz_result.js';
import { log } from '@the-play-button/tpb-sdk-js';
import { toError } from '../../utils/toError.js';
import type { ProjectionKey } from './ProjectionKey';
import type { ProjectionState } from './ProjectionState';
import type { ProjectionEvent } from './ProjectionEvent';

export interface Projection {
    name: string;
    eventTypes: string[];
    getKey: (event: ProjectionEvent) => ProjectionKey;
    reduce: (state: ProjectionState, event: ProjectionEvent & { payload: unknown }) => ProjectionState;
}
