import { describe, it, expect } from 'vitest';
import { createTestContext } from '../../fixtures';

// ── listConnections ────────────────────────────────────────

import { listConnectionsValidateInput } from '../../../../backend/application/connections/listConnections/listConnectionsValidateInput';
import { listConnectionsHydrateContext } from '../../../../backend/application/connections/listConnections/listConnectionsHydrateContext';
import { listConnectionsCheckPolicies } from '../../../../backend/application/connections/listConnections/listConnectionsCheckPolicies';
import { listConnectionsExecute } from '../../../../backend/application/connections/listConnections/listConnectionsExecute';

// ── getDefaultConnection ───────────────────────────────────

import { getDefaultConnectionValidateInput } from '../../../../backend/application/connections/getDefaultConnection/getDefaultConnectionValidateInput';
import { getDefaultConnectionCheckPolicies } from '../../../../backend/application/connections/getDefaultConnection/getDefaultConnectionCheckPolicies';
import { getDefaultConnectionExecute } from '../../../../backend/application/connections/getDefaultConnection/getDefaultConnectionExecute';

// ════════════════════════════════════════════════════════════
// listConnections
// ════════════════════════════════════════════════════════════

describe('listConnections', () => {
  describe('ValidateInput', () => {
    it('returns succeed (pass-through)', () => {
      const result = listConnectionsValidateInput();
      expect(result.ok).toBe(true);
    });
  });

  describe('HydrateContext', () => {
    it('returns succeed (pass-through)', () => {
      const result = listConnectionsHydrateContext();
      expect(result.ok).toBe(true);
    });
  });

  describe('CheckPolicies', () => {
    it('allows when authz passes', async () => {
      const { handlerContext } = createTestContext();
      const result = await listConnectionsCheckPolicies(handlerContext as any);
      expect(result.ok).toBe(true);
    });

    it('denies when authz fails', async () => {
      const { handlerContext, authz } = createTestContext();
      authz.deny();
      const result = await listConnectionsCheckPolicies(handlerContext as any);
      expect(result.ok).toBe(false);
    });
  });

  describe('Execute', () => {
    it('returns connections from resolver', async () => {
      const { handlerContext, connectionResolver } = createTestContext();
      connectionResolver.connections = [
        { id: 'conn_1', integrationType: 'gdrive', category: 'storage' },
        { id: 'conn_2', integrationType: 'onedrive', category: 'storage' },
      ];

      const result = await listConnectionsExecute(handlerContext as any);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0].id).toBe('conn_1');
        expect(result.value[1].integrationType).toBe('onedrive');
      }
    });

    it('returns failure when resolver throws', async () => {
      const { handlerContext, connectionResolver } = createTestContext();
      connectionResolver.getAllConnections = async () => {
        throw new Error('Connection unavailable');
      };

      const result = await listConnectionsExecute(handlerContext as any);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('Connection unavailable');
    });
  });
});

// ════════════════════════════════════════════════════════════
// getDefaultConnection
// ════════════════════════════════════════════════════════════

describe('getDefaultConnection', () => {
  describe('ValidateInput', () => {
    it('returns succeed (pass-through)', () => {
      const result = getDefaultConnectionValidateInput();
      expect(result.ok).toBe(true);
    });
  });

  describe('CheckPolicies', () => {
    it('allows when authz passes', async () => {
      const { handlerContext } = createTestContext();
      const result = await getDefaultConnectionCheckPolicies(handlerContext as any);
      expect(result.ok).toBe(true);
    });

    it('denies when authz fails', async () => {
      const { handlerContext, authz } = createTestContext();
      authz.deny();
      const result = await getDefaultConnectionCheckPolicies(handlerContext as any);
      expect(result.ok).toBe(false);
    });
  });

  describe('Execute', () => {
    it('returns default connection', async () => {
      const { handlerContext } = createTestContext();

      const result = await getDefaultConnectionExecute(handlerContext as any);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe('conn_001');
        expect(result.value.integrationType).toBe('gdrive');
      }
    });

    it('returns failure when no default connection', async () => {
      const { handlerContext, connectionResolver } = createTestContext();
      connectionResolver.getDefaultConnection = async () => {
        throw new Error('No default connection configured');
      };

      const result = await getDefaultConnectionExecute(handlerContext as any);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('No default connection');
    });
  });
});
