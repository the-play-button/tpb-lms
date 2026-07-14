
import type { Result } from './Result.types/Result';
import type { Failure } from './Result.types/Failure';
import type { Success } from './Result.types/Success';
export type { Result };
export type { Failure };
export type { Success };

/**
 * Result type - Either<Failure, Success>
 *
 * Used for domain operations that can fail with business-level errors.
 * No throw for business cases; throw only for infrastructure errors.
 */




export const fail = <F>(error: F): Failure<F> => {
  return { ok: false, error };
};

export const succeed = <S>(value: S): Success<S> => {
  return { ok: true, value };
};

