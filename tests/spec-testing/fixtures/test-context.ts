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

export function createTestContext(actorOverrides: ActorOverrides = {}) {
  const actor = { ...ActorMother.owner(), ...actorOverrides };

  const contentRefsRepository = new InMemoryContentRefsRepository();
  const sharesRepository = new InMemorySharesRepository();
  const authz = new StubAuthzBastionClient();
  const storageService = new StubStorageService();
  const pamClient = new StubPamClient();
  const connectionResolver = new StubConnectionResolver();
  const domainEvents = new StubDomainEvents();

  const handlerContext = {
    contentRefsRepository,
    sharesRepository,
    authzBastionClient: authz,
    storageService,
    pamClient,
    connectionResolver,
    bastionClient: {} as any,
    actor,
    domainEvents,
    userEmail: actor.email ?? OWNER_EMAIL,
    jwt: 'test-jwt-token',
    userScopes: actor.scopes,
    teamDomain: 'test.theplaybutton.ai',
    db: {} as any,
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
