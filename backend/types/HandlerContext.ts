/**
 * HandlerContext - Injected into BYOC handlers
 *
 * Built by createByocContext() in index.js, bridges the JS world
 * (env, userContext) to the TS handler pipeline.
 */

import type { BastionPort } from '../services/bastion/BastionPort.js';
import type { StoragePort } from '../services/storage/StoragePort.js';
import type { PamPort } from '../services/pam/PamPort.js';
import type { ConnectionResolverPort } from '../services/connections/ConnectionResolverPort.js';
import type { ContentRefsRepository } from '../domain/repositories/ContentRefsRepository.js';
import type { SharesRepository } from '../domain/repositories/SharesRepository.js';
import type { DomainEvents } from '../domain/events/DomainEvents.js';

/** Authz-capable bastion client for delegated authorization checks (uses service token + signing secret) */
export interface AuthzBastionClient {
  checkAuthzDelegated(
    subject: { type: string; id: string; context?: { scopes?: string[]; roles?: string[]; organizationId?: string; email?: string } },
    action: string,
    object: { namespace: string; type: string; id: string },
  ): Promise<{ ok: true; value: boolean } | { ok: false; error: string }>;
}

/** Actor identity resolved by middleware (bastion or API key) */
export interface LmsActor {
  id: string;
  email: string | null;
  type: string;
  bastionUserId: string | null;
  scopes: string[];
  organizationId: string | null;
  roles: string[];
}

export interface HandlerContext {
  // === Ports (injected services) ===
  storageService: StoragePort;
  pamClient: PamPort | null;
  connectionResolver: ConnectionResolverPort;
  bastionClient: BastionPort;

  // === Authz-capable bastion client (service token + signing secret) ===
  authzBastionClient: AuthzBastionClient;

  // === Actor (resolved by auth middleware) ===
  actor: LmsActor;

  // === Repositories (domain, publish events) ===
  contentRefsRepository: ContentRefsRepository;
  sharesRepository: SharesRepository;

  // === Domain Events ===
  domainEvents: DomainEvents;

  // === User identity ===
  userEmail: string;
  jwt: string;
  userScopes: string[];
  teamDomain: string;

  // === D1 Database ===
  db: D1Database;
}
