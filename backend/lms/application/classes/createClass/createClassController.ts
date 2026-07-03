import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import { createClassHandle } from './createClassHandle.js';
import { toErrorStatus } from '../../_shared/httpStatus.js';

export const createClassController = async (request: Request, ctx: AuthoringContext, param?: string): Promise<Response> => {
  try {
    const result = await createClassHandle(request, ctx, param);
    if (!result.ok) return Response.json({ error: result.error }, { status: toErrorStatus(result.error) });
    return Response.json(result.value, { status: 201 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
};
