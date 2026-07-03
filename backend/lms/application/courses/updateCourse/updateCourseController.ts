import type { AuthoringContext } from '../../../types/AuthoringContext.js';
import { updateCourseHandle } from './updateCourseHandle.js';
import { toErrorStatus } from '../../_shared/httpStatus.js';

export const updateCourseController = async (request: Request, ctx: AuthoringContext, param?: string): Promise<Response> => {
  try {
    const result = await updateCourseHandle(request, ctx, param);
    if (!result.ok) return Response.json({ error: result.error }, { status: toErrorStatus(result.error) });
    return Response.json(result.value, { status: 200 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
};
