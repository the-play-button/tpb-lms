import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import { createProgramHandle } from './createProgramHandle.js';
import { toErrorStatus } from '../../_shared/httpStatus.js';

export const createProgramController = async (request: Request, ctx: AuthoringContext, _param?: string): Promise<Response> => {
  try {
    const result = await createProgramHandle(request, ctx);
    if (!result.ok) return Response.json({ error: result.error }, { status: toErrorStatus(result.error) });
    return Response.json(result.value, { status: 201 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
};
