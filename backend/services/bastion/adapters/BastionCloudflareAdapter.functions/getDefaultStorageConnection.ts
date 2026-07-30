import type { ConnectionInfo } from '../../../types/ConnectionInfo.types.js';
import { NotFoundError, ServiceUnavailableError } from '../../../../types/errors.js';
import { bastionFetch } from './bastionFetch.js';

export const getDefaultStorageConnection = async (bastionUrl: string, jwt: string): Promise<ConnectionInfo> => {
  // entropy-bastion-connection-endpoint-handrolled-ok: /core/connections/me/default (the org/user DEFAULT connection for a category) has NO BastionClient method — the SDK exposes get/getAuth/listMyConnections/findConnection but not a getDefaultConnection(category). Proper fix = add getDefaultConnection to the SDK (tracked in sub-fleet-app-layer-connection-handrolls); until then this caller-JWT read stays hand-rolled.
  const response = await bastionFetch(bastionUrl, '/core/connections/me/default?category=storage', jwt);

  if (!response.ok) {
    const error = await response.text();
    if (response.status === 404) {
      throw new NotFoundError('Storage connection', 'Please connect your cloud storage in settings.');
    }
    throw new ServiceUnavailableError('Storage connection', `${response.status} - ${error}`);
  }

  const data = (await response.json()) as { connection: ConnectionInfo };
  return data.connection;
};
