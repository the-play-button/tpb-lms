/**
 * PAM Service - Privileged Access Management
 *
 * USAGE: // entropy-single-use-variables-ok: usage example in JSDoc
 * const pam = createPamClient({ bastionUrl: env.BASTION_URL, getToken: () => token });
 * const result = await pam.verifyAccess(connectionId, fileId, guestEmail);
 */

export type { PamPort, PamConfig, PamVerifyResult } from './PamPort.js';

export { PamCloudflareAdapter } from './adapters/PamCloudflareAdapter.js';

import type { PamPort, PamConfig } from './PamPort.js';
import { PamCloudflareAdapter } from './adapters/PamCloudflareAdapter.js';

/**
 * Factory to create PAM client
 *
 * @param config - Configuration with fetcher and token provider
 */
export const createPamClient = (config: PamConfig): PamPort => {
  return new PamCloudflareAdapter(config);
};
