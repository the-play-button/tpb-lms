import { Email, ContentRefId, ShareId, ConnectionId } from '../../../backend/domain/value-objects/index';
import { DraftContentRef } from '../../../backend/domain/entities/ContentRef/DraftContentRef';
import { SharedContentRef } from '../../../backend/domain/entities/ContentRef/SharedContentRef';
import { ActiveShare } from '../../../backend/domain/entities/Share/ActiveShare';
import { RevokedShare } from '../../../backend/domain/entities/Share/RevokedShare';
import type { ContentRefProps, ContentType, ContentUsage } from '../../../backend/domain/entities/ContentRef/types';
import type { ShareProps, RevokedShareProps } from '../../../backend/domain/entities/Share/types';
import type { ShareRole } from '../../../backend/domain/entities/ContentRef/SharedContentRef';

// ── Constants ──────────────────────────────────────────────

export const OWNER_EMAIL = 'owner@test.com';
export const RECIPIENT_EMAIL = 'recipient@test.com';
export const OTHER_EMAIL = 'other@test.com';
export const REF_ID = 'ref_001';
export const SHARE_ID = 'share_001';
export const CONNECTION_ID = 'conn_001';
export const FILE_ID = 'file_001';
export const NOW = new Date('2026-01-01T00:00:00Z');

// ── ContentRef Mother ──────────────────────────────────────

interface ContentRefOverrides {
  id?: string;
  connectionId?: string;
  fileId?: string;
  name?: string;
  contentType?: ContentType;
  ownerEmail?: string;
  courseId?: string | null;
  classId?: string | null;
  usage?: ContentUsage | null;
  lang?: string;
  sourceRefId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

function buildContentRefProps(overrides: ContentRefOverrides = {}): ContentRefProps {
  return {
    id: ContentRefId.reconstitute(overrides.id ?? REF_ID),
    connectionId: ConnectionId.reconstitute(overrides.connectionId ?? CONNECTION_ID),
    fileId: overrides.fileId ?? FILE_ID,
    name: overrides.name ?? 'Test Document',
    contentType: overrides.contentType ?? 'markdown',
    ownerEmail: Email.reconstitute(overrides.ownerEmail ?? OWNER_EMAIL),
    courseId: overrides.courseId ?? null,
    classId: overrides.classId ?? null,
    usage: overrides.usage ?? null,
    lang: overrides.lang ?? 'en',
    sourceRefId: overrides.sourceRefId ? ContentRefId.reconstitute(overrides.sourceRefId) : null,
    createdAt: overrides.createdAt ?? NOW,
    updatedAt: overrides.updatedAt ?? NOW,
  };
}

export const ContentRefMother = {
  draft(overrides: ContentRefOverrides = {}): DraftContentRef {
    return DraftContentRef.reconstitute(buildContentRefProps(overrides));
  },

  shared(overrides: ContentRefOverrides = {}, shares: ActiveShare[] = []): SharedContentRef {
    return SharedContentRef.reconstitute(buildContentRefProps(overrides), shares);
  },

  markdown(overrides: ContentRefOverrides = {}): DraftContentRef {
    return this.draft({ contentType: 'markdown', ...overrides });
  },

  pitch(overrides: ContentRefOverrides = {}): DraftContentRef {
    return this.draft({ contentType: 'pitch', name: 'Presentation.pitch', ...overrides });
  },

  pdf(overrides: ContentRefOverrides = {}): DraftContentRef {
    return this.draft({ contentType: 'pdf', name: 'Document.pdf', ...overrides });
  },
};

// ── Share Mother ───────────────────────────────────────────

interface ShareOverrides {
  id?: string;
  contentRefId?: string;
  sharedByEmail?: string;
  sharedWithEmail?: string;
  role?: ShareRole;
  createdAt?: Date;
  updatedAt?: Date;
}

function buildShareProps(overrides: ShareOverrides = {}): ShareProps {
  return {
    id: ShareId.reconstitute(overrides.id ?? SHARE_ID),
    contentRefId: ContentRefId.reconstitute(overrides.contentRefId ?? REF_ID),
    sharedByEmail: Email.reconstitute(overrides.sharedByEmail ?? OWNER_EMAIL),
    sharedWithEmail: Email.reconstitute(overrides.sharedWithEmail ?? RECIPIENT_EMAIL),
    role: overrides.role ?? 'viewer',
    createdAt: overrides.createdAt ?? NOW,
    updatedAt: overrides.updatedAt ?? NOW,
  };
}

export const ShareMother = {
  active(overrides: ShareOverrides = {}): ActiveShare {
    return ActiveShare.reconstitute(buildShareProps(overrides));
  },

  editor(overrides: ShareOverrides = {}): ActiveShare {
    return ActiveShare.reconstitute(buildShareProps({ role: 'editor', ...overrides }));
  },

  revoked(overrides: ShareOverrides & { revokedByEmail?: string; revokedAt?: Date } = {}): RevokedShare {
    const { revokedByEmail, revokedAt, ...shareOverrides } = overrides;
    const revokedProps: RevokedShareProps = {
      ...buildShareProps(shareOverrides),
      revokedAt: revokedAt ?? NOW,
      revokedByEmail: Email.reconstitute(revokedByEmail ?? OWNER_EMAIL),
    };
    return RevokedShare.reconstitute(revokedProps);
  },
};

// ── Actor Mother ───────────────────────────────────────────

export const ActorMother = {
  owner() {
    return {
      id: 'user_owner',
      email: OWNER_EMAIL,
      type: 'user' as const,
      bastionUserId: 'usr_owner',
      scopes: ['lms:*'],
      organizationId: 'org_001',
      roles: ['admin'],
    };
  },

  recipient() {
    return {
      id: 'user_recipient',
      email: RECIPIENT_EMAIL,
      type: 'user' as const,
      bastionUserId: 'usr_recipient',
      scopes: ['lms:read'],
      organizationId: 'org_001',
      roles: ['viewer'],
    };
  },

  other() {
    return {
      id: 'user_other',
      email: OTHER_EMAIL,
      type: 'user' as const,
      bastionUserId: 'usr_other',
      scopes: ['lms:read'],
      organizationId: 'org_001',
      roles: ['viewer'],
    };
  },
};
