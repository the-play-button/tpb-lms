import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import { deleteCourseHandle } from './deleteCourseHandle.js';
import { toErrorStatus } from '../../_shared/httpStatus.js';

export const deleteCourseController = async (request: Request, ctx: AuthoringContext, param?: string): Promise<Response> => {
  try {
    const result = await deleteCourseHandle(request, ctx, param);
    if (!result.ok) return Response.json({ error: result.error }, { status: toErrorStatus(result.error) });
    return Response.json(result.value, { status: 200 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
};
