// entropy-handler-service-pattern-ok: pattern appropriate
/**
 * Get connection's OAuth token from Unified.to
 * Used for user's own connection (not guest access)
 */

import { ValidationError, NotFoundError, ServiceUnavailableError } from '../../types/errors.js';

export const getConnectionToken = async (getSecret: (path: string) => Promise<string | null>, connectionId: string): Promise<{ accessToken: string; provider: string }> => {
  const unifiedToken = await getSecret('tpb/integrations/unifiedto_api_token');
  if (!unifiedToken) {
    throw new ValidationError('Unified.to API token not configured', { apiToken: 'missing' });
  }

  const response = await fetch(
    `https://api.unified.to/unified/connection/${connectionId}`,
    {
      headers: {
        Authorization: `Bearer ${unifiedToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new ServiceUnavailableError('Unified.to API', `Failed to get connection: ${response.status}`);
  }

  const conn = (await response.json()) as {
    integration_type: string;
    auth?: { access_token?: string };
  };

  if (!conn.auth?.access_token) {
    throw new NotFoundError('Connection', connectionId);
  }

  const accessToken = conn.auth!.access_token!;

  return {
    accessToken,
    provider: conn.integration_type.toLowerCase(),
  };
};
