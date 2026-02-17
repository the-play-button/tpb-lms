import type { IFetcher } from '../../../types/IFetcher.js';

// entropy-subfolders-pattern-ok: adapter functions legitimately perform I/O
export async function bastionFetch(fetcher: IFetcher, path: string, jwt: string): Promise<Response> {
  return fetcher.fetch(
    new Request(`https://bastion${path}`, {
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Jwt-Assertion': jwt,
      },
    })
  );
}
