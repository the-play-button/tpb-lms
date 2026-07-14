/**
 * createByocContext - Bridge between JS world (env, userContext) and TS HandlerContext
 *
 * Called from index.js for BYOC routes. Constructs the full HandlerContext
 * with all ports, repositories, and user identity.
 */

import type { HandlerContext, AuthzBastionClient, LmsActor } from '../lms/types/HandlerContext.js';
import type { Env } from '../types/Env.js';
import { BastionCloudflareAdapter } from '../services/bastion/adapters/BastionCloudflareAdapter.js';
import { TpbStorageHttpAdapter } from '../services/storage/adapters/TpbStorageHttpAdapter.js';
import { PamStorageClientAdapter } from '../services/pam/adapters/PamStorageClientAdapter.js';
import { ConnectionResolverAdapter } from '../services/connections/adapters/ConnectionResolverAdapter.js';
import { ContentRefsDatabaseRepository } from '../lms/infrastructure/repositories/ContentRefsDatabaseRepository.js';
import { SharesDatabaseRepository } from '../lms/infrastructure/repositories/SharesDatabaseRepository.js';
import { JustForwardDomainEventPublisher } from '../lms/infrastructure/events/JustForwardDomainEventPublisher.js';
import { extractCallerJwt, StorageClient } from '@the-play-button/tpb-sdk-js';

interface UserContext {
  user: { email: string };
  contact?: unknown;
  employee?: unknown;
  learner?: unknown;
}

/**
 * Create the BYOC HandlerContext from env + userContext
 *
 * This is the JS/TS bridge: the router (index.js) calls this for every
 * BYOC route, then passes the result to the TS controller.
 *
 * @param authzBastionClient - SDK bastion client (from module-level singleton in index.js) for delegated authz checks (scope+namespace, no HMAC since 2026-05-16)
 * @param actor - Actor resolved by auth middleware
 */
export const createByocContext = async (
  request: Request,
  env: Env,
  userContext: UserContext,
  authzBastionClient: AuthzBastionClient,
  actor: LmsActor,
): Promise<HandlerContext> => {
  const jwt = extractCallerJwt(request) ?? '';
  const { user } = userContext;
  const userEmail = user.email;

  // --- Ports ---
  const bastionClient = new BastionCloudflareAdapter({ bastionUrl: env.BASTION_URL });

  const storageService = new TpbStorageHttpAdapter({
    tpbStorageUrl: env.TPB_STORAGE_URL,  // entropy-connection-capability-hardcoded-url-ok: internal TPB M2M sibling-Worker URL (lms-viewer frontend / tpb-storage) via wrangler [vars]+Env — established pattern, not a vendor connection capability
    bastionToken: env.BASTION_TOKEN,
  });

  // PAM guest reads go through the tpb-storage BC (Plan 11b.b) via the SDK StorageClient, not the
  // bastion escape-hatch. The JWT must carry `storage:delegated:read` (granted per B3-live).
  const pamClient = new PamStorageClientAdapter(new StorageClient(env.TPB_STORAGE_URL, jwt));

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
    authzBastionClient,
    actor,
    contentRefsRepository,
    sharesRepository,
    domainEvents,
    userEmail,
    jwt,
    userScopes: actor.scopes,
    teamDomain: env.ACCESS_TEAM_DOMAIN,
    db: env.DB,
  };
};
