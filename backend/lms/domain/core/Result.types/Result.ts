import type { Failure } from './Failure';
import type { Success } from './Success';

export type Result<F, S> = Failure<F> | Success<S>;
