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

export interface HandlerContext {
  // === Ports (injected services) ===
  storageService: StoragePort;
  pamClient: PamPort | null;
  connectionResolver: ConnectionResolverPort;
  bastionClient: BastionPort;

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
