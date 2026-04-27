import { describe, it, expect, beforeEach } from 'vitest';
import {
  ContentRefMother, ShareMother, ActorMother,
  OWNER_EMAIL, RECIPIENT_EMAIL, OTHER_EMAIL, REF_ID, SHARE_ID,
  createTestContext,
} from '../../fixtures';

// ── shareContent ───────────────────────────────────────────

import { shareContentValidateInput } from '../../../../backend/application/sharing/shareContent/shareContentValidateInput';
import { shareContentHydrateContext } from '../../../../backend/application/sharing/shareContent/shareContentHydrateContext';
import { shareContentCheckPolicies } from '../../../../backend/application/sharing/shareContent/shareContentCheckPolicies';
import { shareContentExecute } from '../../../../backend/application/sharing/shareContent/shareContentExecute';

// ── revokeShare ────────────────────────────────────────────

import { revokeShareValidateInput } from '../../../../backend/application/sharing/revokeShare/revokeShareValidateInput';
import { revokeShareHydrateContext } from '../../../../backend/application/sharing/revokeShare/revokeShareHydrateContext';
import { revokeShareCheckPolicies } from '../../../../backend/application/sharing/revokeShare/revokeShareCheckPolicies';
import { revokeShareExecute } from '../../../../backend/application/sharing/revokeShare/revokeShareExecute';

// ── listPermissions ────────────────────────────────────────

import { listPermissionsValidateInput } from '../../../../backend/application/sharing/listPermissions/listPermissionsValidateInput';
import { listPermissionsHydrateContext } from '../../../../backend/application/sharing/listPermissions/listPermissionsHydrateContext';
import { listPermissionsCheckPolicies } from '../../../../backend/application/sharing/listPermissions/listPermissionsCheckPolicies';
import { listPermissionsExecute } from '../../../../backend/application/sharing/listPermissions/listPermissionsExecute';

// ── sharedWithMe ───────────────────────────────────────────

import { sharedWithMeValidateInput } from '../../../../backend/application/sharing/sharedWithMeValidateInput';
import { sharedWithMeCheckPolicies } from '../../../../backend/application/sharing/sharedWithMeCheckPolicies';
import { sharedWithMeExecute } from '../../../../backend/application/sharing/sharedWithMeExecute';

// ── sharedByMe ─────────────────────────────────────────────

import { sharedByMeValidateInput } from '../../../../backend/application/sharing/sharedByMeValidateInput';
import { sharedByMeCheckPolicies } from '../../../../backend/application/sharing/sharedByMeCheckPolicies';
import { sharedByMeExecute } from '../../../../backend/application/sharing/sharedByMeExecute';

// ════════════════════════════════════════════════════════════
// shareContent
// ════════════════════════════════════════════════════════════

describe('shareContent', () => {
  describe('ValidateInput', () => {
    it('accepts valid input', async () => {
      const request = new Request('http://test.local', {
        method: 'POST',
        body: JSON.stringify({ email: RECIPIENT_EMAIL, role: 'READ' }),
      });
      const result = await shareContentValidateInput(request, REF_ID);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.ref_id).toBe(REF_ID);
        expect(result.value.email).toBe(RECIPIENT_EMAIL);
        expect(result.value.role).toBe('READ');
      }
    });

    it('rejects invalid JSON body', async () => {
      const request = new Request('http://test.local', {
        method: 'POST',
        body: 'not json',
      });
      const result = await shareContentValidateInput(request, REF_ID);
      expect(result.ok).toBe(false);
    });

    it('rejects missing email', async () => {
      const request = new Request('http://test.local', {
        method: 'POST',
        body: JSON.stringify({ role: 'READ' }),
      });
      const result = await shareContentValidateInput(request, REF_ID);
      expect(result.ok).toBe(false);
    });

    it('rejects invalid email format', async () => {
      const request = new Request('http://test.local', {
        method: 'POST',
        body: JSON.stringify({ email: 'not-email', role: 'READ' }),
      });
      const result = await shareContentValidateInput(request, REF_ID);
      expect(result.ok).toBe(false);
    });

    it('rejects invalid role', async () => {
      const request = new Request('http://test.local', {
        method: 'POST',
        body: JSON.stringify({ email: RECIPIENT_EMAIL, role: 'ADMIN' }),
      });
      const result = await shareContentValidateInput(request, REF_ID);
      expect(result.ok).toBe(false);
    });
  });

  describe('HydrateContext', () => {
    it('loads contentRef and existing shares', async () => {
      const { handlerContext, contentRefsRepository } = createTestContext();
      const ref = ContentRefMother.draft();
      contentRefsRepository.refs.set(ref.id.value, ref);

      const input = { ref_id: REF_ID, email: RECIPIENT_EMAIL, role: 'READ' as const };
      const result = await shareContentHydrateContext(input, handlerContext as any);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.contentRef.id.value).toBe(REF_ID);
        expect(result.value.existingShares).toHaveLength(0);
      }
    });

    it('fails when contentRef not found', async () => {
      const { handlerContext } = createTestContext();
      const input = { ref_id: 'nonexistent', email: RECIPIENT_EMAIL, role: 'READ' as const };
      const result = await shareContentHydrateContext(input, handlerContext as any);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('NOT_FOUND');
    });
  });

  describe('CheckPolicies', () => {
    it('allows owner with authz', async () => {
      const { handlerContext } = createTestContext();
      const ref = ContentRefMother.draft();
      const context = { contentRef: ref, existingShares: [] as any[] };
      const result = await shareContentCheckPolicies(context as any, OWNER_EMAIL, handlerContext as any);
      expect(result.ok).toBe(true);
    });

    it('denies when authz fails', async () => {
      const { handlerContext, authz } = createTestContext();
      authz.deny();
      const ref = ContentRefMother.draft();
      const context = { contentRef: ref, existingShares: [] as any[] };
      const result = await shareContentCheckPolicies(context as any, OWNER_EMAIL, handlerContext as any);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('FORBIDDEN');
    });

    it('denies non-owner', async () => {
      const { handlerContext } = createTestContext();
      const ref = ContentRefMother.draft();
      const context = { contentRef: ref, existingShares: [] as any[] };
      const result = await shareContentCheckPolicies(context as any, OTHER_EMAIL, handlerContext as any);
      expect(result.ok).toBe(false);
    });

    it('denies when max shares reached', async () => {
      const { handlerContext } = createTestContext();
      const ref = ContentRefMother.draft();
      const shares = Array.from({ length: 50 }, (_, i) =>
        ShareMother.active({ id: `s_${i}`, sharedWithEmail: `u${i}@t.com` }),
      );
      const context = { contentRef: ref, existingShares: shares };
      const result = await shareContentCheckPolicies(context as any, OWNER_EMAIL, handlerContext as any);
      expect(result.ok).toBe(false);
    });
  });

  describe('Execute', () => {
    it('creates and saves share', async () => {
      const { handlerContext, sharesRepository } = createTestContext();
      const ref = ContentRefMother.draft();
      const context = { contentRef: ref, existingShares: [] as any[] };
      const input = { ref_id: REF_ID, email: RECIPIENT_EMAIL, role: 'READ' as const };

      const result = await shareContentExecute(input, context as any, handlerContext as any);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.shared_with).toBe(RECIPIENT_EMAIL);
        expect(result.value.role).toBe('READ');
        expect(result.value.content_ref_id).toBe(REF_ID);
      }
      expect(sharesRepository.shares.size).toBe(1);
    });

    it('emits content.shared event', async () => {
      const { handlerContext, domainEvents } = createTestContext();
      const ref = ContentRefMother.draft();
      const context = { contentRef: ref, existingShares: [] as any[] };
      const input = { ref_id: REF_ID, email: RECIPIENT_EMAIL, role: 'WRITE' as const };

      await shareContentExecute(input, context as any, handlerContext as any);
      expect(domainEvents.published).toHaveLength(1);
      expect(domainEvents.published[0].type).toBe('content.shared');
    });

    it('maps WRITE role to editor domain role', async () => {
      const { handlerContext, sharesRepository } = createTestContext();
      const ref = ContentRefMother.draft();
      const context = { contentRef: ref, existingShares: [] as any[] };
      const input = { ref_id: REF_ID, email: RECIPIENT_EMAIL, role: 'WRITE' as const };

      await shareContentExecute(input, context as any, handlerContext as any);
      const saved = [...sharesRepository.shares.values()][0];
      expect(saved.role).toBe('editor');
    });
  });
});

// ════════════════════════════════════════════════════════════
// revokeShare
// ════════════════════════════════════════════════════════════

describe('revokeShare', () => {
  describe('ValidateInput', () => {
    it('accepts valid share_id', () => {
      const result = revokeShareValidateInput(SHARE_ID);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.share_id).toBe(SHARE_ID);
    });

    it('rejects empty share_id', () => {
      const result = revokeShareValidateInput('');
      expect(result.ok).toBe(false);
    });
  });

  describe('HydrateContext', () => {
    it('loads active share and contentRef', async () => {
      const { handlerContext, sharesRepository, contentRefsRepository } = createTestContext();
      const ref = ContentRefMother.draft();
      const share = ShareMother.active();
      contentRefsRepository.refs.set(ref.id.value, ref);
      sharesRepository.shares.set(share.id.value, share);

      const result = await revokeShareHydrateContext(SHARE_ID, handlerContext as any);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.share.id.value).toBe(SHARE_ID);
        expect(result.value.isOwner).toBe(true);
      }
    });

    it('fails when share not found', async () => {
      const { handlerContext } = createTestContext();
      const result = await revokeShareHydrateContext('nonexistent', handlerContext as any);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('NOT_FOUND');
    });

    it('fails when share is already revoked', async () => {
      const { handlerContext, sharesRepository, contentRefsRepository } = createTestContext();
      const ref = ContentRefMother.draft();
      const revoked = ShareMother.revoked();
      contentRefsRepository.refs.set(ref.id.value, ref);
      sharesRepository.shares.set(revoked.id.value, revoked);

      const result = await revokeShareHydrateContext(SHARE_ID, handlerContext as any);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('NOT_FOUND');
    });

    it('detects non-owner correctly', async () => {
      const { handlerContext, sharesRepository, contentRefsRepository } = createTestContext({
        email: OTHER_EMAIL,
      });
      handlerContext.userEmail = OTHER_EMAIL;
      const ref = ContentRefMother.draft();
      const share = ShareMother.active();
      contentRefsRepository.refs.set(ref.id.value, ref);
      sharesRepository.shares.set(share.id.value, share);

      const result = await revokeShareHydrateContext(SHARE_ID, handlerContext as any);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.isOwner).toBe(false);
    });
  });

  describe('CheckPolicies', () => {
    it('allows owner with authz', async () => {
      const { handlerContext } = createTestContext();
      const context = { share: ShareMother.active(), contentRef: ContentRefMother.draft(), isOwner: true };
      const result = await revokeShareCheckPolicies(context as any, handlerContext as any);
      expect(result.ok).toBe(true);
    });

    it('denies when authz fails', async () => {
      const { handlerContext, authz } = createTestContext();
      authz.deny();
      const context = { share: ShareMother.active(), contentRef: ContentRefMother.draft(), isOwner: true };
      const result = await revokeShareCheckPolicies(context as any, handlerContext as any);
      expect(result.ok).toBe(false);
    });

    it('denies non-owner', async () => {
      const { handlerContext } = createTestContext();
      const context = { share: ShareMother.active(), contentRef: ContentRefMother.draft(), isOwner: false };
      const result = await revokeShareCheckPolicies(context as any, handlerContext as any);
      expect(result.ok).toBe(false);
    });
  });

  describe('Execute', () => {
    it('revokes share and saves', async () => {
      const { handlerContext, sharesRepository } = createTestContext();
      const share = ShareMother.active();
      const ref = ContentRefMother.draft();
      const context = { share, contentRef: ref, isOwner: true };

      const result = await revokeShareExecute(context as any, handlerContext as any);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.share_id).toBe(SHARE_ID);
        expect(result.value.revoked_at).toBeDefined();
      }
      const saved = sharesRepository.shares.get(SHARE_ID);
      expect(saved?.kind).toBe('revoked');
    });

    it('emits share.revoked event', async () => {
      const { handlerContext, domainEvents } = createTestContext();
      const share = ShareMother.active();
      const ref = ContentRefMother.draft();
      const context = { share, contentRef: ref, isOwner: true };

      await revokeShareExecute(context as any, handlerContext as any);
      expect(domainEvents.published).toHaveLength(1);
      expect(domainEvents.published[0].type).toBe('share.revoked');
    });
  });
});

// ════════════════════════════════════════════════════════════
// listPermissions
// ════════════════════════════════════════════════════════════

describe('listPermissions', () => {
  describe('ValidateInput', () => {
    it('accepts valid ref_id', () => {
      const result = listPermissionsValidateInput(REF_ID);
      expect(result.ok).toBe(true);
    });

    it('rejects empty ref_id', () => {
      const result = listPermissionsValidateInput('');
      expect(result.ok).toBe(false);
    });
  });

  describe('HydrateContext', () => {
    it('loads contentRef and determines ownership', async () => {
      const { handlerContext, contentRefsRepository } = createTestContext();
      const ref = ContentRefMother.draft();
      contentRefsRepository.refs.set(ref.id.value, ref);

      const result = await listPermissionsHydrateContext({ ref_id: REF_ID }, handlerContext as any);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.isOwner).toBe(true);
        expect(result.value.shares).toHaveLength(0);
      }
    });

    it('fails when contentRef not found', async () => {
      const { handlerContext } = createTestContext();
      const result = await listPermissionsHydrateContext({ ref_id: 'missing' }, handlerContext as any);
      expect(result.ok).toBe(false);
    });
  });

  describe('CheckPolicies', () => {
    it('allows owner with authz', async () => {
      const { handlerContext } = createTestContext();
      const context = { contentRef: ContentRefMother.draft(), shares: [], isOwner: true };
      const result = await listPermissionsCheckPolicies(context as any, handlerContext as any);
      expect(result.ok).toBe(true);
    });

    it('denies when authz fails', async () => {
      const { handlerContext, authz } = createTestContext();
      authz.deny();
      const context = { contentRef: ContentRefMother.draft(), shares: [], isOwner: true };
      const result = await listPermissionsCheckPolicies(context as any, handlerContext as any);
      expect(result.ok).toBe(false);
    });

    it('denies non-owner', async () => {
      const { handlerContext } = createTestContext();
      const context = { contentRef: ContentRefMother.draft(), shares: [], isOwner: false };
      const result = await listPermissionsCheckPolicies(context as any, handlerContext as any);
      expect(result.ok).toBe(false);
    });
  });

  describe('Execute', () => {
    it('maps shares to permission entries', () => {
      const share = ShareMother.editor({ sharedWithEmail: RECIPIENT_EMAIL });
      const ref = ContentRefMother.draft();
      const context = { contentRef: ref, shares: [share], isOwner: true };

      const result = listPermissionsExecute(context as any);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.permissions).toHaveLength(1);
        expect(result.value.permissions[0].role).toBe('WRITE');
        expect(result.value.permissions[0].shared_with).toBe(RECIPIENT_EMAIL);
        expect(result.value.owner_email).toBe(OWNER_EMAIL);
      }
    });

    it('returns empty permissions when no shares', () => {
      const ref = ContentRefMother.draft();
      const context = { contentRef: ref, shares: [], isOwner: true };

      const result = listPermissionsExecute(context as any);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.permissions).toHaveLength(0);
    });
  });
});

// ════════════════════════════════════════════════════════════
// sharedWithMe
// ════════════════════════════════════════════════════════════

describe('sharedWithMe', () => {
  describe('ValidateInput', () => {
    it('accepts valid email', () => {
      const result = sharedWithMeValidateInput(RECIPIENT_EMAIL);
      expect(result.ok).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = sharedWithMeValidateInput('not-email');
      expect(result.ok).toBe(false);
    });
  });

  describe('CheckPolicies', () => {
    it('allows when authz passes', async () => {
      const { handlerContext } = createTestContext();
      const result = await sharedWithMeCheckPolicies(handlerContext as any);
      expect(result.ok).toBe(true);
    });

    it('denies when authz fails', async () => {
      const { handlerContext, authz } = createTestContext();
      authz.deny();
      const result = await sharedWithMeCheckPolicies(handlerContext as any);
      expect(result.ok).toBe(false);
    });
  });

  describe('Execute', () => {
    it('returns shares with enriched content info', async () => {
      const { handlerContext, sharesRepository, contentRefsRepository } = createTestContext();
      const ref = ContentRefMother.draft();
      const share = ShareMother.active({ sharedWithEmail: OWNER_EMAIL });
      contentRefsRepository.refs.set(ref.id.value, ref);
      sharesRepository.shares.set(share.id.value, share);

      const input = { userEmail: OWNER_EMAIL };
      const result = await sharedWithMeExecute(input, handlerContext as any);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].name).toBe('Test Document');
        expect(result.value[0].content_type).toBe('markdown');
      }
    });

    it('returns empty array when no shares', async () => {
      const { handlerContext } = createTestContext();
      const input = { userEmail: OWNER_EMAIL };
      const result = await sharedWithMeExecute(input, handlerContext as any);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toHaveLength(0);
    });
  });
});

// ════════════════════════════════════════════════════════════
// sharedByMe
// ════════════════════════════════════════════════════════════

describe('sharedByMe', () => {
  describe('ValidateInput', () => {
    it('accepts valid email', () => {
      const result = sharedByMeValidateInput(OWNER_EMAIL);
      expect(result.ok).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = sharedByMeValidateInput('bad');
      expect(result.ok).toBe(false);
    });
  });

  describe('CheckPolicies', () => {
    it('allows when authz passes', async () => {
      const { handlerContext } = createTestContext();
      const result = await sharedByMeCheckPolicies(handlerContext as any);
      expect(result.ok).toBe(true);
    });

    it('denies when authz fails', async () => {
      const { handlerContext, authz } = createTestContext();
      authz.deny();
      const result = await sharedByMeCheckPolicies(handlerContext as any);
      expect(result.ok).toBe(false);
    });
  });

  describe('Execute', () => {
    it('returns shares with role mapping', async () => {
      const { handlerContext, sharesRepository } = createTestContext();
      const share = ShareMother.editor({ sharedByEmail: OWNER_EMAIL });
      sharesRepository.shares.set(share.id.value, share);

      const input = { userEmail: OWNER_EMAIL };
      const result = await sharedByMeExecute(input, handlerContext as any);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].role).toBe('WRITE');
        expect(result.value[0].shared_with).toBe(RECIPIENT_EMAIL);
      }
    });

    it('returns empty when no shares by user', async () => {
      const { handlerContext } = createTestContext();
      const input = { userEmail: OTHER_EMAIL };
      const result = await sharedByMeExecute(input, handlerContext as any);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toHaveLength(0);
    });
  });
});
