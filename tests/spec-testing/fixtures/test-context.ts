import type { HandlerContext } from '../../../backend/lms/types/HandlerContext.types';
import {
  InMemoryContentRefsRepository,
  InMemorySharesRepository,
  StubAuthzBastionClient,
  StubStorageService,
  StubPamClient,
  StubConnectionResolver,
  StubDomainEvents,
} from './stubs';
import { ActorMother, OWNER_EMAIL } from './mothers';

type ActorOverrides = Partial<ReturnType<typeof ActorMother.owner>>;

/** A port these use-case tests never reach: any access fails loud instead of returning undefined. */
function unusedPort<Port extends object>(name: string): Port {
  return new Proxy({}, {
    get: (_target, property) => {
      throw new Error(`test context: ${name}.${String(property)} was used but is not stubbed`);
    },
  }) as Port;
}

export function createTestContext(actorOverrides: ActorOverrides = {}) {
  const actor = { ...ActorMother.owner(), ...actorOverrides };

  const contentRefsRepository = new InMemoryContentRefsRepository();
  const sharesRepository = new InMemorySharesRepository();
  const authz = new StubAuthzBastionClient();
  const storageService = new StubStorageService();
  const pamClient = new StubPamClient();
  const connectionResolver = new StubConnectionResolver();
  const domainEvents = new StubDomainEvents();

  const handlerContext: HandlerContext = {
    contentRefsRepository,
    sharesRepository,
    authzBastionClient: authz,
    storageService,
    pamClient,
    connectionResolver,
    bastionClient: unusedPort<HandlerContext['bastionClient']>('bastionClient'),
    actor,
    domainEvents,
    userEmail: actor.email ?? OWNER_EMAIL,
    jwt: 'test-jwt-token',
    userScopes: actor.scopes,
    teamDomain: 'test.theplaybutton.ai',
    db: unusedPort<HandlerContext['db']>('db'),
  };

  return {
    actor,
    contentRefsRepository,
    sharesRepository,
    authz,
    storageService,
    pamClient,
    connectionResolver,
    domainEvents,
    handlerContext,
  };
}
