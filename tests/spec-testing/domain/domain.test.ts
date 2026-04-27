import { describe, it, expect } from 'vitest';
import { Email, ContentRefId, ShareId, ConnectionId } from '../../../backend/domain/value-objects/index';
import { DraftContentRef } from '../../../backend/domain/entities/ContentRef/DraftContentRef';
import { SharedContentRef } from '../../../backend/domain/entities/ContentRef/SharedContentRef';
import { ActiveShare } from '../../../backend/domain/entities/Share/ActiveShare';
import { RevokedShare } from '../../../backend/domain/entities/Share/RevokedShare';
import { onlyOwnerCanSharePolicy, maxSharesPolicy } from '../../../backend/domain/policies/SharingPolicies';
import { enrolledLearnerPolicy, ownerAccessPolicy } from '../../../backend/domain/policies/ContentAccessPolicies';
import { filterContentRefFields } from '../../../backend/domain/policies/FieldAccessPolicies';
import { ContentRefMother, ShareMother, OWNER_EMAIL, RECIPIENT_EMAIL, OTHER_EMAIL, REF_ID, NOW } from '../fixtures';

// ── Value Objects ──────────────────────────────────────────

describe('Value Objects', () => {
  describe('Email', () => {
    it('creates valid email', () => {
      const result = Email.create('USER@Test.Com');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.value).toBe('user@test.com');
    });

    it('rejects empty email', () => {
      const result = Email.create('');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('empty');
    });

    it('rejects whitespace-only email', () => {
      const result = Email.create('   ');
      expect(result.ok).toBe(false);
    });

    it('rejects invalid format', () => {
      const result = Email.create('not-an-email');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('invalid');
    });

    it('reconstitute creates without validation', () => {
      const email = Email.reconstitute('raw-value');
      expect(email.value).toBe('raw-value');
    });

    it('equals returns true for same value', () => {
      const a = Email.reconstitute('a@b.com');
      const b = Email.reconstitute('a@b.com');
      expect(a.equals(b)).toBe(true);
    });

    it('equals returns false for different value', () => {
      const a = Email.reconstitute('a@b.com');
      const b = Email.reconstitute('x@y.com');
      expect(a.equals(b)).toBe(false);
    });

    it('domain getter returns domain part', () => {
      const email = Email.reconstitute('user@example.org');
      expect(email.domain).toBe('example.org');
    });
  });

  describe('ContentRefId', () => {
    it('creates valid id', () => {
      const result = ContentRefId.create('ref_123');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.value).toBe('ref_123');
    });

    it('rejects empty id', () => {
      const result = ContentRefId.create('');
      expect(result.ok).toBe(false);
    });

    it('trims whitespace', () => {
      const result = ContentRefId.create('  ref_123  ');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.value).toBe('ref_123');
    });

    it('equals compares by value', () => {
      const a = ContentRefId.reconstitute('ref_1');
      const b = ContentRefId.reconstitute('ref_1');
      const c = ContentRefId.reconstitute('ref_2');
      expect(a.equals(b)).toBe(true);
      expect(a.equals(c)).toBe(false);
    });
  });

  describe('ShareId', () => {
    it('creates valid id', () => {
      const result = ShareId.create('share_123');
      expect(result.ok).toBe(true);
    });

    it('rejects empty id', () => {
      const result = ShareId.create('');
      expect(result.ok).toBe(false);
    });

    it('equals compares by value', () => {
      const a = ShareId.reconstitute('s1');
      const b = ShareId.reconstitute('s1');
      expect(a.equals(b)).toBe(true);
    });
  });

  describe('ConnectionId', () => {
    it('creates valid id', () => {
      const result = ConnectionId.create('conn_123');
      expect(result.ok).toBe(true);
    });

    it('rejects empty id', () => {
      const result = ConnectionId.create('');
      expect(result.ok).toBe(false);
    });

    it('equals compares by value', () => {
      const a = ConnectionId.reconstitute('c1');
      const b = ConnectionId.reconstitute('c2');
      expect(a.equals(b)).toBe(false);
    });
  });
});

// ── Entities ───────────────────────────────────────────────

describe('Entities', () => {
  describe('DraftContentRef', () => {
    it('creates valid draft with required fields', () => {
      const result = DraftContentRef.create({
        id: ContentRefId.reconstitute('ref_new'),
        connectionId: ConnectionId.reconstitute('conn_1'),
        fileId: 'file_abc',
        name: 'My Document',
        contentType: 'markdown',
        ownerEmail: Email.reconstitute(OWNER_EMAIL),
        lang: 'en',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe('draft');
        expect(result.value.fileId).toBe('file_abc');
        expect(result.value.name).toBe('My Document');
      }
    });

    it('rejects empty fileId', () => {
      const result = DraftContentRef.create({
        id: ContentRefId.reconstitute('ref_new'),
        connectionId: ConnectionId.reconstitute('conn_1'),
        fileId: '',
        name: 'Doc',
        contentType: 'markdown',
        ownerEmail: Email.reconstitute(OWNER_EMAIL),
        lang: 'en',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('fileId');
    });

    it('rejects empty name', () => {
      const result = DraftContentRef.create({
        id: ContentRefId.reconstitute('ref_new'),
        connectionId: ConnectionId.reconstitute('conn_1'),
        fileId: 'file_1',
        name: '',
        contentType: 'markdown',
        ownerEmail: Email.reconstitute(OWNER_EMAIL),
        lang: 'en',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('name');
    });

    it('rejects empty lang', () => {
      const result = DraftContentRef.create({
        id: ContentRefId.reconstitute('ref_new'),
        connectionId: ConnectionId.reconstitute('conn_1'),
        fileId: 'file_1',
        name: 'Doc',
        contentType: 'markdown',
        ownerEmail: Email.reconstitute(OWNER_EMAIL),
        lang: '',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('lang');
    });

    it('reconstitute preserves all properties', () => {
      const ref = ContentRefMother.draft({ courseId: 'course_1', classId: 'class_1', usage: 'intro' });
      expect(ref.id.value).toBe(REF_ID);
      expect(ref.courseId).toBe('course_1');
      expect(ref.classId).toBe('class_1');
      expect(ref.usage).toBe('intro');
      expect(ref.lang).toBe('en');
      expect(ref.createdAt).toEqual(NOW);
    });

    it('toProps returns snapshot', () => {
      const ref = ContentRefMother.draft();
      const props = ref.toProps();
      expect(props.fileId).toBe(ref.fileId);
      expect(props.name).toBe(ref.name);
    });
  });

  describe('SharedContentRef', () => {
    it('reconstitute with shares', () => {
      const share = ShareMother.active();
      const ref = ContentRefMother.shared({}, [share]);
      expect(ref.kind).toBe('shared');
      expect(ref.shares).toHaveLength(1);
    });

    it('share succeeds with different email', () => {
      const ref = ContentRefMother.shared({});
      const result = ref.share(Email.reconstitute(RECIPIENT_EMAIL), 'viewer');
      expect(result.ok).toBe(true);
    });

    it('share fails when sharing with owner (self-share)', () => {
      const ref = ContentRefMother.shared({});
      const result = ref.share(Email.reconstitute(OWNER_EMAIL), 'viewer');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('owner');
    });

    it('share fails when already shared with same email', () => {
      const share = ShareMother.active({ sharedWithEmail: RECIPIENT_EMAIL });
      const ref = ContentRefMother.shared({}, [share]);
      const result = ref.share(Email.reconstitute(RECIPIENT_EMAIL), 'viewer');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('already shared');
    });

    it('shares getter returns a copy', () => {
      const share = ShareMother.active();
      const ref = ContentRefMother.shared({}, [share]);
      const shares1 = ref.shares;
      const shares2 = ref.shares;
      expect(shares1).not.toBe(shares2);
      expect(shares1).toEqual(shares2);
    });
  });

  describe('ActiveShare', () => {
    it('creates valid share', () => {
      const result = ActiveShare.create({
        id: ShareId.reconstitute('share_new'),
        contentRefId: ContentRefId.reconstitute(REF_ID),
        sharedByEmail: Email.reconstitute(OWNER_EMAIL),
        sharedWithEmail: Email.reconstitute(RECIPIENT_EMAIL),
        role: 'viewer',
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.kind).toBe('active');
    });

    it('rejects self-share', () => {
      const result = ActiveShare.create({
        id: ShareId.reconstitute('share_new'),
        contentRefId: ContentRefId.reconstitute(REF_ID),
        sharedByEmail: Email.reconstitute(OWNER_EMAIL),
        sharedWithEmail: Email.reconstitute(OWNER_EMAIL),
        role: 'viewer',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('yourself');
    });

    it('revoke returns RevokedShare', () => {
      const share = ShareMother.active();
      const result = share.revoke(Email.reconstitute(OWNER_EMAIL));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.kind).toBe('revoked');
        expect(result.value.revokedByEmail.value).toBe(OWNER_EMAIL);
        expect(result.value.id.equals(share.id)).toBe(true);
      }
    });

    it('toProps returns snapshot', () => {
      const share = ShareMother.active();
      const props = share.toProps();
      expect(props.role).toBe('viewer');
    });
  });

  describe('RevokedShare', () => {
    it('reconstitute preserves all fields', () => {
      const revoked = ShareMother.revoked({ revokedByEmail: OTHER_EMAIL });
      expect(revoked.kind).toBe('revoked');
      expect(revoked.revokedByEmail.value).toBe(OTHER_EMAIL);
      expect(revoked.revokedAt).toEqual(NOW);
    });

    it('exposes all getters', () => {
      const revoked = ShareMother.revoked();
      expect(revoked.id.value).toBeDefined();
      expect(revoked.contentRefId.value).toBeDefined();
      expect(revoked.sharedByEmail.value).toBe(OWNER_EMAIL);
      expect(revoked.sharedWithEmail.value).toBe(RECIPIENT_EMAIL);
      expect(revoked.role).toBe('viewer');
    });

    it('toProps returns snapshot', () => {
      const revoked = ShareMother.revoked();
      const props = revoked.toProps();
      expect(props.revokedAt).toBeDefined();
      expect(props.revokedByEmail.value).toBe(OWNER_EMAIL);
    });
  });
});

// ── Policies ───────────────────────────────────────────────

describe('Policies', () => {
  describe('SharingPolicies', () => {
    it('onlyOwnerCanSharePolicy allows owner', () => {
      const ref = ContentRefMother.draft();
      const result = onlyOwnerCanSharePolicy(ref, Email.reconstitute(OWNER_EMAIL));
      expect(result.ok).toBe(true);
    });

    it('onlyOwnerCanSharePolicy denies non-owner', () => {
      const ref = ContentRefMother.draft();
      const result = onlyOwnerCanSharePolicy(ref, Email.reconstitute(OTHER_EMAIL));
      expect(result.ok).toBe(false);
    });

    it('maxSharesPolicy allows under limit', () => {
      const shares = [ShareMother.active()];
      const result = maxSharesPolicy(shares);
      expect(result.ok).toBe(true);
    });

    it('maxSharesPolicy denies at default limit', () => {
      const shares = Array.from({ length: 50 }, (_, i) =>
        ShareMother.active({ id: `share_${i}`, sharedWithEmail: `user${i}@test.com` }),
      );
      const result = maxSharesPolicy(shares);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('50');
    });

    it('maxSharesPolicy respects custom limit', () => {
      const shares = [ShareMother.active(), ShareMother.active({ id: 'share_002' })];
      const result = maxSharesPolicy(shares, 2);
      expect(result.ok).toBe(false);
    });
  });

  describe('ContentAccessPolicies', () => {
    it('enrolledLearnerPolicy denies null enrollment', () => {
      const result = enrolledLearnerPolicy(null);
      expect(result.ok).toBe(false);
    });

    it('enrolledLearnerPolicy denies inactive enrollment', () => {
      const result = enrolledLearnerPolicy({
        learnerEmail: RECIPIENT_EMAIL,
        courseId: 'c1',
        classId: 'cl1',
        active: false,
      });
      expect(result.ok).toBe(false);
    });

    it('enrolledLearnerPolicy allows active enrollment', () => {
      const result = enrolledLearnerPolicy({
        learnerEmail: RECIPIENT_EMAIL,
        courseId: 'c1',
        classId: 'cl1',
        active: true,
      });
      expect(result.ok).toBe(true);
    });

    it('ownerAccessPolicy allows owner', () => {
      const ref = ContentRefMother.draft();
      const result = ownerAccessPolicy(ref, Email.reconstitute(OWNER_EMAIL));
      expect(result.ok).toBe(true);
    });

    it('ownerAccessPolicy denies non-owner', () => {
      const ref = ContentRefMother.draft();
      const result = ownerAccessPolicy(ref, Email.reconstitute(OTHER_EMAIL));
      expect(result.ok).toBe(false);
    });
  });

  describe('FieldAccessPolicies', () => {
    it('owner gets full content ref fields', () => {
      const ref = ContentRefMother.draft();
      const filtered = filterContentRefFields(ref, Email.reconstitute(OWNER_EMAIL));
      expect('connectionId' in filtered).toBe(true);
      expect('ownerEmail' in filtered).toBe(true);
      expect('createdAt' in filtered).toBe(true);
    });

    it('non-owner gets filtered content ref fields', () => {
      const ref = ContentRefMother.draft();
      const filtered = filterContentRefFields(ref, Email.reconstitute(OTHER_EMAIL));
      expect('id' in filtered).toBe(true);
      expect('name' in filtered).toBe(true);
      expect('connectionId' in filtered).toBe(false);
      expect('ownerEmail' in filtered).toBe(false);
    });
  });
});
