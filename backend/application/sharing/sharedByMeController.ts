import type { HandlerContext } from '../../types/HandlerContext.js';
import { sharedByMeHandle } from './sharedByMeHandle.js';

export async function sharedByMeController(
  _request: Request,
  ctx: HandlerContext
): Promise<Response> {
  try {
    const result = await sharedByMeHandle(ctx);
    if (!result.ok) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ shares: result.value }), {
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
