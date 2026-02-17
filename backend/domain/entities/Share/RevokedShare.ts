import type { ShareId, ContentRefId, Email } from '../../value-objects/index.js';
import type { ShareRole } from '../ContentRef/SharedContentRef.js';
import type { RevokedShareProps } from './types.js';

/**
 * RevokedShare Entity (read-only)
 *
 * Represents a sharing relationship that has been revoked.
 * Immutable -- no commands, only queries.
 */
export class RevokedShare {
  readonly kind = 'revoked' as const;

  private constructor(private readonly props: RevokedShareProps) {}

  static reconstitute(props: RevokedShareProps): RevokedShare {
    return new RevokedShare(props);
  }

  // === Getters ===

  get id(): ShareId { return this.props.id; }
  get contentRefId(): ContentRefId { return this.props.contentRefId; }
  get sharedByEmail(): Email { return this.props.sharedByEmail; }
  get sharedWithEmail(): Email { return this.props.sharedWithEmail; }
  get role(): ShareRole { return this.props.role; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get revokedAt(): Date { return this.props.revokedAt; }
  get revokedByEmail(): Email { return this.props.revokedByEmail; }

  /**
   * Returns a plain-object snapshot of all properties.
   */
  toProps(): Readonly<RevokedShareProps> {
    return { ...this.props };
  }
}
