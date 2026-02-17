// entropy-class-method-length-ok: cohesive method
import { fail, succeed, type Result } from '../core/Result.js';

/**
 * ShareId Value Object
 * Represents a unique identifier for a Share
 */
export class ShareId {
  private constructor(public readonly value: string) {}

  static create(value: string): Result<string, ShareId> {
    if (!value || value.trim() === '') return fail('ShareId cannot be empty');
    return succeed(new ShareId(value.trim()));
  }

  static reconstitute(value: string): ShareId {
    return new ShareId(value);
  }

  equals(other: ShareId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
