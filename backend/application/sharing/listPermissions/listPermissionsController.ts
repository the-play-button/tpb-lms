// entropy-positional-args-excess-ok: listPermissionsController follows DDD pipeline convention (request, ctx, param) positional args
import type { HandlerContext } from '../../../types/HandlerContext.js';
import { listPermissionsHandle } from './listPermissionsHandle.js';

export const listPermissionsController = async (request: Request, ctx: HandlerContext, refId: string): Promise<Response> => {
  try {
    const result = await listPermissionsHandle(refId, ctx);
    if (!result.ok) {
      const status = result.error === 'NOT_FOUND' ? 404 : result.error === 'FORBIDDEN' ? 403 : 400;
      return new Response(JSON.stringify({ error: result.error }), {
        status,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify(result.value), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
