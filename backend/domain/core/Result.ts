// entropy-error-hierarchy-ok: error structure appropriate
// entropy-god-file-ok: Result monad — Failure/Success types + fail/succeed/unwrap constructors, single source of truth for domain error handling
/**
 * Result type - Either<Failure, Success>
 *
 * Used for domain operations that can fail with business-level errors.
 * No throw for business cases; throw only for infrastructure errors.
 */

export type Result<F, S> = Failure<F> | Success<S>;

export interface Failure<F> {
  readonly ok: false;
  readonly error: F;
}

export interface Success<S> {
  readonly ok: true;
  readonly value: S;
}

export const fail = <F>(error: F): Failure<F> => {
  return { ok: false, error };
};

export const succeed = <S>(value: S): Success<S> => {
  return { ok: true, value };
};

/**
 * Unwrap a Result, throwing if it's a Failure.
 * Use sparingly — prefer pattern matching with ok/error.
 */
export const unwrap = <F, S>(result: Result<F, S>): S => {
  if (!result.ok) {
    throw new Error(`Unwrap called on Failure: ${JSON.stringify(result.error)}`);
  }
  return result.value;
};
