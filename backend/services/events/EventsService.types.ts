import { applyProjections, getProgress } from '../../projections/engine.js';
import { generateEventId } from '../../utils/events.js';
import type { Env } from "../../types/Env.js";

export interface ValidatedEvent {
    type: string;
    course_id?: string;
    class_id: string;
    payload?: unknown;
}
