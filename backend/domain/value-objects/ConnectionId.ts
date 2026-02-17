// entropy-class-method-length-ok: DDD value object — validation + factory + reconstitute + equality + toString for ConnectionId, tightly coupled by single-value invariant
import { fail, succeed, type Result } from '../core/Result.js';

/**
 * ConnectionId Value Object
 * Represents a unique identifier for a Connection (Google Drive, etc.)
 */
export class ConnectionId {
  private constructor(public readonly value: string) {}

  static create(value: string): Result<string, ConnectionId> {
    if (!value || value.trim() === '') return fail('ConnectionId cannot be empty');
    return succeed(new ConnectionId(value.trim()));
  }

  static reconstitute(value: string): ConnectionId {
    return new ConnectionId(value);
  }

  equals(other: ConnectionId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
