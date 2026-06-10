// entropy-subfolders-pattern-ok: adapter functions legitimately perform I/O
export const bastionFetch = async (bastionUrl: string, path: string, jwt: string): Promise<Response> => {
  return fetch(`${bastionUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'Cf-Access-Jwt-Assertion': jwt,
    },
  });
};
