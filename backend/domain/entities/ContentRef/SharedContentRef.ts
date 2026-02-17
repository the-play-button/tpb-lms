// entropy-multiple-exports-ok: cohesive module exports
// entropy-god-file-ok: DDD entity — reconstitute + share command with duplicate/self-share guards + property accessors for SharedContentRef
import { fail, succeed, type Result } from '../../core/Result.js';
import type { ContentRefId, ConnectionId, Email } from '../../value-objects/index.js';
import type { ContentRefProps, ContentType, ContentUsage } from './types.js';
import type { ActiveShare } from '../Share/ActiveShare.js';

export type ShareRole = 'viewer' | 'editor';

/**
 * SharedContentRef Entity
 *
 * Represents a content reference that has been shared with others.
 * Tracks active shares and supports sharing operations.
 */
export class SharedContentRef {
  readonly kind = 'shared' as const;

  private constructor(
    private readonly props: ContentRefProps,
    private readonly _shares: ActiveShare[],
  ) {}

  static reconstitute(props: ContentRefProps, shares: ActiveShare[]): SharedContentRef {
    return new SharedContentRef(props, shares);
  }

  // === Commands ===

  /**
   * Validate that this content ref can be shared with the given email and role.
   * Returns Result to allow the caller to create the Share aggregate separately.
   */
  share(email: Email, role: ShareRole): Result<string, { contentRefId: ContentRefId; email: Email; role: ShareRole }> {
    if (email.equals(this.props.ownerEmail)) {
      return fail('Cannot share content with the owner');
    }

    const alreadyShared = this._shares.some(
      (s) => s.sharedWithEmail.equals(email)
    );
    if (alreadyShared) {
      return fail('Content is already shared with this email');
    }

    return succeed({
      contentRefId: this.props.id,
      email,
      role,
    });
  }

  // === Getters ===

  get id(): ContentRefId { return this.props.id; }
  get connectionId(): ConnectionId { return this.props.connectionId; }
  get fileId(): string { return this.props.fileId; }
  get name(): string { return this.props.name; }
  get contentType(): ContentType { return this.props.contentType; }
  get ownerEmail(): Email { return this.props.ownerEmail; }
  get courseId(): string | null { return this.props.courseId; }
  get classId(): string | null { return this.props.classId; }
  get usage(): ContentUsage | null { return this.props.usage; }
  get lang(): string { return this.props.lang; }
  get sourceRefId(): ContentRefId | null { return this.props.sourceRefId; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get shares(): readonly ActiveShare[] { return [...this._shares]; }

  /**
   * Returns a plain-object snapshot of all properties.
   * Useful for persistence and serialization.
   */
  toProps(): Readonly<ContentRefProps> {
    return { ...this.props };
  }
}
