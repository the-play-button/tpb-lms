export interface Failure<F> {
  readonly ok: false;
  readonly error: F;
}
