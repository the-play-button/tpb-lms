/**
 * PAM Service - Privileged Access Management
 *
 * USAGE:
 * const pam = createPamClient({ fetcher: env.BASTION, getToken: () => token });
 * const result = await pam.verifyAccess(connectionId, fileId, guestEmail);
 */

// Port types
export type { PamPort, PamConfig, PamVerifyResult } from './PamPort.js';

// Adapters
export { PamCloudflareAdapter } from './adapters/PamCloudflareAdapter.js';

import type { PamPort, PamConfig } from './PamPort.js';
import { PamCloudflareAdapter } from './adapters/PamCloudflareAdapter.js';

/**
 * Factory to create PAM client
 *
 * @param config - Configuration with fetcher and token provider
 */
export function createPamClient(config: PamConfig): PamPort {
  return new PamCloudflareAdapter(config);
}
