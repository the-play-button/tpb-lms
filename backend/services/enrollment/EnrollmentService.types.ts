import { generateId, MAX_ACTIVE_ENROLLMENTS } from '../../handlers/enrollment/_shared.js';
import type { Env } from "../../types/Env.types.js";

export type EnrollmentActionResult =
    | { error: { status: number; body: unknown } }
    | { value: { status: number; body: unknown } };
