
export type EnrollmentActionResult =
    | { error: { status: number; body: unknown } }
    | { value: { status: number; body: unknown } };
