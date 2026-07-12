/**
 * Programs handler — thin transport adapter over ProgramsService.
 */
import { jsonResponse } from '../cors.js';
import { listProgramsForUser } from '../services/programs/ProgramsService.js';

/** GET /api/programs — list active programs (grouping level above courses). */
export const listPrograms = async (request, env) => {
    const body = await listProgramsForUser(env);
    return jsonResponse(body, 200, request);
};
