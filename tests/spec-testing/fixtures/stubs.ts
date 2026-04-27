import type { DraftContentRef } from '../../../backend/domain/entities/ContentRef/DraftContentRef';
import type { SharedContentRef } from '../../../backend/domain/entities/ContentRef/SharedContentRef';
import type { ActiveShare } from '../../../backend/domain/entities/Share/ActiveShare';
import type { RevokedShare } from '../../../backend/domain/entities/Share/RevokedShare';
import type { ContentRefId, ShareId, Email } from '../../../backend/domain/value-objects/index';
import type { DomainEvent } from '../../../backend/domain/events/DomainEvent';

type ContentRef = DraftContentRef | SharedContentRef;
type Share = ActiveShare | RevokedShare;

// ── InMemoryContentRefsRepository ──────────────────────────

export class InMemoryContentRefsRepository {
  readonly refs = new Map<string, ContentRef>();

  async findById(id: ContentRefId): Promise<ContentRef | null> {
    return this.refs.get(id.value) ?? null;
  }

  async findByCourseId(courseId: string): Promise<ContentRef[]> {
    return [...this.refs.values()].filter(r => r.courseId === courseId);
  }

  async findByClassId(classId: string): Promise<ContentRef[]> {
    return [...this.refs.values()].filter(r => r.classId === classId);
  }

  async save(contentRef: ContentRef): Promise<void> {
    this.refs.set(contentRef.id.value, contentRef);
  }

  async publish(_event: DomainEvent, contentRef: ContentRef): Promise<void> {
    this.refs.set(contentRef.id.value, contentRef);
  }
}

// ── InMemorySharesRepository ───────────────────────────────

export class InMemorySharesRepository {
  readonly shares = new Map<string, Share>();

  async findById(id: ShareId): Promise<Share | null> {
    return this.shares.get(id.value) ?? null;
  }

  async findActiveByContentRef(contentRefId: ContentRefId): Promise<ActiveShare[]> {
    return [...this.shares.values()].filter(
      (s): s is ActiveShare => s.kind === 'active' && s.contentRefId.equals(contentRefId),
    );
  }

  async findBySharedWith(email: Email): Promise<Share[]> {
    return [...this.shares.values()].filter(s => s.sharedWithEmail.equals(email));
  }

  async findBySharedBy(email: Email): Promise<Share[]> {
    return [...this.shares.values()].filter(s => s.sharedByEmail.equals(email));
  }

  async save(share: ActiveShare | RevokedShare): Promise<void> {
    this.shares.set(share.id.value, share);
  }

  async publish(_event: DomainEvent, share: ActiveShare | RevokedShare): Promise<void> {
    this.shares.set(share.id.value, share);
  }
}

// ── StubAuthzBastionClient ─────────────────────────────────

export class StubAuthzBastionClient {
  private _allowed = true;
  private _error: string | null = null;

  deny(): void {
    this._allowed = false;
    this._error = null;
  }

  allow(): void {
    this._allowed = true;
    this._error = null;
  }

  setError(error: string): void {
    this._error = error;
  }

  async checkAuthzDelegated(
    _subject: { type: string; id: string; context?: Record<string, unknown> },
    _action: string,
    _object: { namespace: string; type: string; id: string },
  ): Promise<{ ok: true; value: boolean } | { ok: false; error: string }> {
    if (this._error) return { ok: false, error: this._error };
    return { ok: true, value: this._allowed };
  }
}

// ── StubStorageService ─────────────────────────────────────

export class StubStorageService {
  content = '# Test Content\n\nHello world.';
  binary = new ArrayBuffer(8);

  async getFileContent(_connectionId: string, _fileId: string): Promise<string> {
    return this.content;
  }

  async getFileBinary(_connectionId: string, _fileId: string): Promise<ArrayBuffer> {
    return this.binary;
  }
}

// ── StubPamClient ──────────────────────────────────────────

export class StubPamClient {
  content = 'pam-delegated-content';

  async verifyAccess(_connectionId: string, _fileId: string, _guestEmail: string): Promise<{ allowed: boolean }> {
    return { allowed: true };
  }

  async getContent(_connectionId: string, _fileId: string, _guestEmail: string): Promise<{ content: string }> {
    return { content: this.content };
  }

  async listFiles(_connectionId: string, _parentId: string, _guestEmail: string): Promise<unknown[]> {
    return [];
  }

  async resolveRelativePath(_connectionId: string, _baseFolderId: string, _relativePath: string, _guestEmail: string): Promise<never> {
    throw new Error('Not implemented in stub');
  }
}

// ── StubConnectionResolver ─────────────────────────────────

export class StubConnectionResolver {
  connections = [
    { id: 'conn_001', integrationType: 'gdrive', category: 'storage' },
  ];

  async findWorkingConnection(_provider: string, _folderId: string) {
    return this.connections[0];
  }

  async resolveConnection(_params: { connectionId?: string; provider?: string; folderId?: string }) {
    return this.connections[0];
  }

  async getAllConnections() {
    return this.connections;
  }

  async getDefaultConnection() {
    return this.connections[0];
  }
}

// ── StubDomainEvents ───────────────────────────────────────

export class StubDomainEvents {
  readonly published: DomainEvent[] = [];

  async publish(event: DomainEvent): Promise<void> {
    this.published.push(event);
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    this.published.push(...events);
  }
}
