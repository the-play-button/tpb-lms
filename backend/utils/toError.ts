/**
 * Normalize a caught `unknown` (strict `catch (e)` binds `unknown`) into an
 * `Error`, for passing to `log.error(message, error, context?)` whose 2nd
 * parameter is typed `Error | null`.
 */
export const toError = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e)));
