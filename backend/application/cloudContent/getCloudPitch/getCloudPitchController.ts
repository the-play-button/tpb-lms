import type { HandlerContext } from '../../../types/HandlerContext.js';
import { getCloudPitchHandle } from './getCloudPitchHandle.js';

export async function getCloudPitchController(
  request: Request,
  ctx: HandlerContext
): Promise<Response> {
  try {
    const result = await getCloudPitchHandle(request, ctx);
    if (!result.ok) {
      const status = result.error === 'NOT_FOUND' ? 404 : result.error === 'FORBIDDEN' ? 403 : 400;
      return new Response(JSON.stringify({ error: result.error }), {
        status,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(result.value.binary, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${result.value.fileName}"`,
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
