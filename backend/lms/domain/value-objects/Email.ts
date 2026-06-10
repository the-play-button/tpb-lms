import { fail, succeed, type Result } from '../core/Result.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email Value Object
 * Represents a validated, normalized email address
 */
export class Email {
  private constructor(public readonly value: string) {}

  static create(value: string): Result<string, Email> {
    if (!value || value.trim() === '') return fail('Email cannot be empty');
    const normalized = value.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalized)) return fail('Email format is invalid');
    return succeed(new Email(normalized));
  }

  static reconstitute(value: string): Email {
    return new Email(value);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  get domain(): string {
    return this.value.split('@')[1];
  }

  toString(): string {
    return this.value;
  }
}
