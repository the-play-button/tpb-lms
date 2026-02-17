// entropy-god-file-ok: port interface — IFetcher fetch-compatible contract for Cloudflare worker-to-worker service bindings
/**
 * IFetcher - Interface for fetch-compatible service bindings
 *
 * Matches the Cloudflare Service Binding interface.
 * Used by bastion adapters for worker-to-worker calls.
 */
export interface IFetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}
