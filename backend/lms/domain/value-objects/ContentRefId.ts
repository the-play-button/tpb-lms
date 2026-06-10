import { fail, succeed, type Result } from '../core/Result.js';

/**
 * ContentRefId Value Object
 * Represents a unique identifier for a ContentRef
 */
export class ContentRefId {
  private constructor(public readonly value: string) {}

  static create(value: string): Result<string, ContentRefId> {
    if (!value || value.trim() === '') return fail('ContentRefId cannot be empty');
    return succeed(new ContentRefId(value.trim()));
  }

  static reconstitute(value: string): ContentRefId {
    return new ContentRefId(value);
  }

  equals(other: ContentRefId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
