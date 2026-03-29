// entropy-error-hierarchy-ok: error structure appropriate
/**
 * createByocContext - Bridge between JS world (env, userContext) and TS HandlerContext
 *
 * Called from index.js for BYOC routes. Constructs the full HandlerContext
 * with all ports, repositories, and user identity.
 */

import type { HandlerContext } from '../types/HandlerContext.js';
import type { Env } from '../types/Env.js';
import { BastionCloudflareAdapter } from '../services/bastion/adapters/BastionCloudflareAdapter.js';
import { UnifiedStorageAdapter } from '../services/storage/adapters/UnifiedStorageAdapter.js';
import { PamCloudflareAdapter } from '../services/pam/adapters/PamCloudflareAdapter.js';
import { ConnectionResolverAdapter } from '../services/connections/adapters/ConnectionResolverAdapter.js';
import { ContentRefsDatabaseRepository } from '../infrastructure/repositories/ContentRefsDatabaseRepository.js';
import { SharesDatabaseRepository } from '../infrastructure/repositories/SharesDatabaseRepository.js';
import { JustForwardDomainEventPublisher } from '../infrastructure/events/JustForwardDomainEventPublisher.js';

interface UserContext {
  user: { email: string };
  contact?: unknown;
  employee?: unknown;
  learner?: unknown;
}

/**
 * Extract JWT from request headers
 */
function extractJwt(request: Request): string {
  return request.headers.get('Cf-Access-Jwt-Assertion') || '';
}

/**
 * Create the BYOC HandlerContext from env + userContext
 *
 * This is the JS/TS bridge: the router (index.js) calls this for every
 * BYOC route, then passes the result to the TS controller.
 */
export async function createByocContext(
  request: Request,
  env: Env,
  userContext: UserContext
): Promise<HandlerContext> {
  const jwt = extractJwt(request);
  const userEmail = userContext.user.email;

  // --- Ports ---
  const bastionClient = new BastionCloudflareAdapter({ bastionUrl: env.BASTION_URL });

  const storageService = new UnifiedStorageAdapter({
    getApiToken: async () => {
      const token = await bastionClient.getSecret(jwt, 'integrations/unifiedto_api_token');
      if (!token) throw new Error('Unified.to API token not found in vault');
      return token;
    },
  });
  await storageService.initialize();

  const pamClient = new PamCloudflareAdapter({
    bastionUrl: env.BASTION_URL,
    getToken: () => env.VAULT_TOKEN,
  });

  const connectionResolver = new ConnectionResolverAdapter({
    getAllConnections: () => bastionClient.getAllStorageConnections(jwt),
    getDefaultConnection: () => bastionClient.getDefaultStorageConnection(jwt),
    getConnectionsByProvider: (provider: string) =>
      bastionClient.getConnectionsByProvider(jwt, provider),
    testAccess: async (connectionId: string, folderId: string) => {
      await storageService.listFiles(connectionId, folderId);
    },
  });

  // --- Domain Events ---
  const domainEvents = new JustForwardDomainEventPublisher();

  // --- Repositories ---
  const contentRefsRepository = new ContentRefsDatabaseRepository(env.DB, domainEvents);
  const sharesRepository = new SharesDatabaseRepository(env.DB, domainEvents);

  return {
    storageService,
    pamClient,
    connectionResolver,
    bastionClient,
    contentRefsRepository,
    sharesRepository,
    domainEvents,
    userEmail,
    jwt,
    userScopes: [], // TODO: extract from JWT claims when RBAC is enabled
    teamDomain: env.ACCESS_TEAM_DOMAIN,
    db: env.DB,
  };
}
