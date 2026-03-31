import type { ConnectionInfo } from '../../../types/ConnectionInfo.js';
import { NotFoundError, ServiceUnavailableError } from '../../../../types/errors.js';
import { bastionFetch } from './bastionFetch.js';

export const getDefaultStorageConnection = async (bastionUrl: string, jwt: string): Promise<ConnectionInfo> => {
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
