export interface Success<S> {
  readonly ok: true;
  readonly value: S;
}
