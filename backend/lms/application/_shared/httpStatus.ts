/** Map a domain error string to an HTTP status. */
export const toErrorStatus = (error: string): number => {
  if (error === 'NOT_FOUND') return 404;
  if (error === 'FORBIDDEN') return 403;
  return 400;
};
