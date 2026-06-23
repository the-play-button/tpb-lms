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

