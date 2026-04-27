import { describe, it, expect } from 'vitest';
import {
  ContentRefMother, ShareMother, ActorMother,
  OWNER_EMAIL, RECIPIENT_EMAIL, OTHER_EMAIL, REF_ID, CONNECTION_ID, FILE_ID,
  createTestContext,
} from '../../fixtures';

// ── getCloudContent ────────────────────────────────────────

import { getCloudContentValidateInput } from '../../../../backend/application/cloudContent/getCloudContent/getCloudContentValidateInput';
import { getCloudContentHydrateContext } from '../../../../backend/application/cloudContent/getCloudContent/getCloudContentHydrateContext';
import { getCloudContentCheckPolicies } from '../../../../backend/application/cloudContent/getCloudContent/getCloudContentCheckPolicies';
import { getCloudContentExecute } from '../../../../backend/application/cloudContent/getCloudContent/getCloudContentExecute';

// ── getCloudPitch ──────────────────────────────────────────

import { getCloudPitchValidateInput } from '../../../../backend/application/cloudContent/getCloudPitch/getCloudPitchValidateInput';
import { getCloudPitchHydrateContext } from '../../../../backend/application/cloudContent/getCloudPitch/getCloudPitchHydrateContext';
import { getCloudPitchCheckPolicies } from '../../../../backend/application/cloudContent/getCloudPitch/getCloudPitchCheckPolicies';
import { getCloudPitchExecute } from '../../../../backend/application/cloudContent/getCloudPitch/getCloudPitchExecute';

// ════════════════════════════════════════════════════════════
// getCloudContent
// ════════════════════════════════════════════════════════════

describe('getCloudContent', () => {
  describe('ValidateInput', () => {
    it('accepts valid ref_id', () => {
      const request = new Request(`http://test.local?ref_id=${REF_ID}`);
      const result = getCloudContentValidateInput(request);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.ref_id).toBe(REF_ID);
    });

    it('rejects missing ref_id', () => {
      const request = new Request('http://test.local');
      const result = getCloudContentValidateInput(request);
      expect(result.ok).toBe(false);
    });

    it('accepts optional lang parameter', () => {
      const request = new Request(`http://test.local?ref_id=${REF_ID}&lang=fr`);
      const result = getCloudContentValidateInput(request);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.lang).toBe('fr');
    });
  });

  describe('HydrateContext', () => {
    it('identifies owner', async () => {
      const { handlerContext, contentRefsRepository } = createTestContext();
      const ref = ContentRefMother.draft();
      contentRefsRepository.refs.set(ref.id.value, ref);

      const result = await getCloudContentHydrateContext({ ref_id: REF_ID }, handlerContext as any);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.isOwner).toBe(true);
        expect(result.value.isEnrolled).toBe(false);
      }
    });

    it('identifies enrolled non-owner via active share', async () => {
      const { handlerContext, contentRefsRepository, sharesRepository } = createTestContext({
        email: RECIPIENT_EMAIL,
      });
      handlerContext.userEmail = RECIPIENT_EMAIL;
      const ref = ContentRefMother.draft();
      const share = ShareMother.active({ sharedWithEmail: RECIPIENT_EMAIL });
      contentRefsRepository.refs.set(ref.id.value, ref);
      sharesRepository.shares.set(share.id.value, share);

      const result = await getCloudContentHydrateContext({ ref_id: REF_ID }, handlerContext as any);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.isOwner).toBe(false);
        expect(result.value.isEnrolled).toBe(true);
      }
    });

    it('identifies non-owner non-enrolled', async () => {
      const { handlerContext, contentRefsRepository } = createTestContext({
        email: OTHER_EMAIL,
      });
      handlerContext.userEmail = OTHER_EMAIL;
      const ref = ContentRefMother.draft();
      contentRefsRepository.refs.set(ref.id.value, ref);

      const result = await getCloudContentHydrateContext({ ref_id: REF_ID }, handlerContext as any);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.isOwner).toBe(false);
        expect(result.value.isEnrolled).toBe(false);
      }
    });

    it('fails when contentRef not found', async () => {
      const { handlerContext } = createTestContext();
      const result = await getCloudContentHydrateContext({ ref_id: 'missing' }, handlerContext as any);
      expect(result.ok).toBe(false);
    });
  });

  describe('CheckPolicies', () => {
    it('allows owner', async () => {
      const { handlerContext } = createTestContext();
      const context = { contentRef: ContentRefMother.draft(), isOwner: true, isEnrolled: false };
      const result = await getCloudContentCheckPolicies(context as any, handlerContext as any);
      expect(result.ok).toBe(true);
    });

    it('allows enrolled non-owner', async () => {
      const { handlerContext } = createTestContext();
      const context = { contentRef: ContentRefMother.draft(), isOwner: false, isEnrolled: true };
      const result = await getCloudContentCheckPolicies(context as any, handlerContext as any);
      expect(result.ok).toBe(true);
    });

    it('denies non-owner non-enrolled', async () => {
      const { handlerContext } = createTestContext();
      const context = { contentRef: ContentRefMother.draft(), isOwner: false, isEnrolled: false };
      const result = await getCloudContentCheckPolicies(context as any, handlerContext as any);
      expect(result.ok).toBe(false);
    });

    it('denies when authz fails', async () => {
      const { handlerContext, authz } = createTestContext();
      authz.deny();
      const context = { contentRef: ContentRefMother.draft(), isOwner: true, isEnrolled: false };
      const result = await getCloudContentCheckPolicies(context as any, handlerContext as any);
      expect(result.ok).toBe(false);
    });
  });

  describe('Execute', () => {
    it('owner gets content from storage service', async () => {
      const { handlerContext, storageService } = createTestContext();
      storageService.content = '# Hello from storage';
      const ref = ContentRefMother.markdown();
      const context = { contentRef: ref, isOwner: true, isEnrolled: false };

      const result = await getCloudContentExecute(context as any, handlerContext as any);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.content).toBe('# Hello from storage');
        expect(result.value.contentType).toBe('text/markdown; charset=utf-8');
      }
    });

    it('non-owner gets content from PAM', async () => {
      const { handlerContext, pamClient } = createTestContext();
      pamClient.content = 'delegated content';
      const ref = ContentRefMother.markdown();
      const context = { contentRef: ref, isOwner: false, isEnrolled: true };

      const result = await getCloudContentExecute(context as any, handlerContext as any);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.content).toBe('delegated content');
    });

    it('fails when PAM unavailable for non-owner', async () => {
      const { handlerContext } = createTestContext();
      handlerContext.pamClient = null;
      const ref = ContentRefMother.markdown();
      const context = { contentRef: ref, isOwner: false, isEnrolled: true };

      const result = await getCloudContentExecute(context as any, handlerContext as any);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('PAM');
    });

    it('emits content.accessed event', async () => {
      const { handlerContext, domainEvents } = createTestContext();
      const ref = ContentRefMother.markdown();
      const context = { contentRef: ref, isOwner: true, isEnrolled: false };

      await getCloudContentExecute(context as any, handlerContext as any);
      expect(domainEvents.published).toHaveLength(1);
      expect(domainEvents.published[0].type).toBe('content.accessed');
    });

    it('returns correct contentType for pdf', async () => {
      const { handlerContext } = createTestContext();
      const ref = ContentRefMother.pdf();
      const context = { contentRef: ref, isOwner: true, isEnrolled: false };

      const result = await getCloudContentExecute(context as any, handlerContext as any);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.contentType).toBe('application/pdf');
    });
  });
});

// ════════════════════════════════════════════════════════════
// getCloudPitch
// ════════════════════════════════════════════════════════════

describe('getCloudPitch', () => {
  describe('ValidateInput', () => {
    it('accepts valid ref_id', () => {
      const request = new Request(`http://test.local?ref_id=${REF_ID}`);
      const result = getCloudPitchValidateInput(request);
      expect(result.ok).toBe(true);
    });

    it('rejects missing ref_id', () => {
      const request = new Request('http://test.local');
      const result = getCloudPitchValidateInput(request);
      expect(result.ok).toBe(false);
    });
  });

  describe('HydrateContext', () => {
    it('loads contentRef and determines access', async () => {
      const { handlerContext, contentRefsRepository } = createTestContext();
      const ref = ContentRefMother.pitch();
      contentRefsRepository.refs.set(ref.id.value, ref);

      const result = await getCloudPitchHydrateContext({ ref_id: REF_ID }, handlerContext as any);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.isOwner).toBe(true);
    });

    it('fails when not found', async () => {
      const { handlerContext } = createTestContext();
      const result = await getCloudPitchHydrateContext({ ref_id: 'missing' }, handlerContext as any);
      expect(result.ok).toBe(false);
    });
  });

  describe('CheckPolicies', () => {
    it('allows owner', async () => {
      const { handlerContext } = createTestContext();
      const context = { contentRef: ContentRefMother.pitch(), isOwner: true, isEnrolled: false };
      const result = await getCloudPitchCheckPolicies(context as any, handlerContext as any);
      expect(result.ok).toBe(true);
    });

    it('allows enrolled non-owner', async () => {
      const { handlerContext } = createTestContext();
      const context = { contentRef: ContentRefMother.pitch(), isOwner: false, isEnrolled: true };
      const result = await getCloudPitchCheckPolicies(context as any, handlerContext as any);
      expect(result.ok).toBe(true);
    });

    it('denies non-owner non-enrolled', async () => {
      const { handlerContext } = createTestContext();
      const context = { contentRef: ContentRefMother.pitch(), isOwner: false, isEnrolled: false };
      const result = await getCloudPitchCheckPolicies(context as any, handlerContext as any);
      expect(result.ok).toBe(false);
    });
  });

  describe('Execute', () => {
    it('owner gets binary from storage service', async () => {
      const { handlerContext, storageService } = createTestContext();
      const buf = new ArrayBuffer(16);
      storageService.binary = buf;
      const ref = ContentRefMother.pitch();
      const context = { contentRef: ref, isOwner: true, isEnrolled: false };

      const result = await getCloudPitchExecute(context as any, handlerContext as any);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.binary).toBe(buf);
        expect(result.value.fileName).toBe('Presentation.pitch');
      }
    });

    it('appends .pitch extension when missing', async () => {
      const { handlerContext } = createTestContext();
      const ref = ContentRefMother.draft({ contentType: 'pitch', name: 'MyPres' });
      const context = { contentRef: ref, isOwner: true, isEnrolled: false };

      const result = await getCloudPitchExecute(context as any, handlerContext as any);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.fileName).toBe('MyPres.pitch');
    });

    it('emits content.accessed event', async () => {
      const { handlerContext, domainEvents } = createTestContext();
      const ref = ContentRefMother.pitch();
      const context = { contentRef: ref, isOwner: true, isEnrolled: false };

      await getCloudPitchExecute(context as any, handlerContext as any);
      expect(domainEvents.published).toHaveLength(1);
      expect(domainEvents.published[0].type).toBe('content.accessed');
    });
  });
});
