import type { HandlerContext } from '../../../types/HandlerContext.js';
import { listPermissionsHandle } from './listPermissionsHandle.js';

export async function listPermissionsController(
  request: Request,
  ctx: HandlerContext
): Promise<Response> {
  try {
    const result = await listPermissionsHandle(request, ctx);
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
}
