import { jsonResponse } from '../../cors.js';
import { recordQuizEvent, checkQuizBadges, checkStreakBadges } from '../../utils/xp/index.js';
import { applyProjections } from '../../projections/engine.js';
import { generateEventId } from '../../utils/events.js';
import { log } from '@the-play-button/tpb-sdk-js';
import type { Env } from "../../types/Env.js";

export interface QuizClassRow {
    id?: string;
    course_id?: string;
    media_json?: string | null;
    raw_json?: string | null;
    [key: string]: unknown;
}
