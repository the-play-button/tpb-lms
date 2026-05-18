import type { HandlerContext } from '../../../types/HandlerContext.js';
import { listConnectionsHandle } from './listConnectionsHandle.js';

export const listConnectionsController = async (_request: Request, ctx: HandlerContext): Promise<Response> => {
  try {
    const result = await listConnectionsHandle(ctx);
    if (!result.ok) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ connections: result.value }), {
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
