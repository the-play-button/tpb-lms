import type { HandlerContext } from '../../../types/HandlerContext.js';
import { shareContentHandle } from './shareContentHandle.js';

export async function shareContentController(
  request: Request,
  ctx: HandlerContext,
  refId: string
): Promise<Response> {
  try {
    const result = await shareContentHandle(request, ctx, refId);
    if (!result.ok) {
      const status = result.error === 'NOT_FOUND' ? 404
        : result.error === 'FORBIDDEN' ? 403
        : result.error.includes('Only the owner') ? 403
        : 400;
      return new Response(JSON.stringify({ error: result.error }), {
        status,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify(result.value), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
