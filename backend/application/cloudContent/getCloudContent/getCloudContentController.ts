import type { HandlerContext } from '../../../types/HandlerContext.js';
import { getCloudContentHandle } from './getCloudContentHandle.js';

export async function getCloudContentController(
  request: Request,
  ctx: HandlerContext
): Promise<Response> {
  try {
    const result = await getCloudContentHandle(request, ctx);
    if (!result.ok) {
      const status = result.error === 'NOT_FOUND' ? 404 : result.error === 'FORBIDDEN' ? 403 : 400;
      return new Response(JSON.stringify({ error: result.error }), {
        status,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(result.value.content, {
      status: 200,
      headers: {
        'Content-Type': result.value.contentType || 'text/markdown; charset=utf-8',
        'Cache-Control': 'private, max-age=300'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
