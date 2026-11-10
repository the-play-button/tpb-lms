import { callerHeaders } from '@the-play-button/tpb-sdk-js';
export const bastionFetch = async (bastionUrl: string, path: string, jwt: string): Promise<Response> => {
  return fetch(`${bastionUrl}${path}`, {
    headers: {
      ...callerHeaders(),
      'Content-Type': 'application/json',
      'Cf-Access-Jwt-Assertion': jwt,
    },
  });
};
