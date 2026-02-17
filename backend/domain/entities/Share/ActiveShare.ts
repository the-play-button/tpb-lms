import { fail, succeed, type Result } from '../../core/Result.js';
import type { ShareId, ContentRefId, Email } from '../../value-objects/index.js';
import type { ShareRole } from '../ContentRef/SharedContentRef.js';
import type { ShareProps } from './types.js';
import { RevokedShare } from './RevokedShare.js';

/**
 * ActiveShare Entity
 *
 * Represents an active sharing relationship between an owner and a recipient.
 * Can be revoked, which produces a RevokedShare.
 */
export class ActiveShare {
  readonly kind = 'active' as const;

  private constructor(private readonly props: ShareProps) {}

  static create(params: {
    id: ShareId;
    contentRefId: ContentRefId;
    sharedByEmail: Email;
    sharedWithEmail: Email;
    role: ShareRole;
  }): Result<string, ActiveShare> {
    if (params.sharedByEmail.equals(params.sharedWithEmail)) {
      return fail('Cannot share with yourself');
    }

    const now = new Date();
    return succeed(
      new ActiveShare({
        id: params.id,
        contentRefId: params.contentRefId,
        sharedByEmail: params.sharedByEmail,
        sharedWithEmail: params.sharedWithEmail,
        role: params.role,
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  static reconstitute(props: ShareProps): ActiveShare {
    return new ActiveShare(props);
  }

  // === Commands ===

  /**
   * Revoke this share. Returns a RevokedShare with revocation metadata.
   */
  revoke(revokedByEmail: Email): Result<string, RevokedShare> {
    return succeed(
      RevokedShare.reconstitute({
        ...this.props,
        revokedAt: new Date(),
        revokedByEmail,
      })
    );
  }

  // === Getters ===

  get id(): ShareId { return this.props.id; }
  get contentRefId(): ContentRefId { return this.props.contentRefId; }
  get sharedByEmail(): Email { return this.props.sharedByEmail; }
  get sharedWithEmail(): Email { return this.props.sharedWithEmail; }
  get role(): ShareRole { return this.props.role; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  /**
   * Returns a plain-object snapshot of all properties.
   */
  toProps(): Readonly<ShareProps> {
    return { ...this.props };
  }
}
