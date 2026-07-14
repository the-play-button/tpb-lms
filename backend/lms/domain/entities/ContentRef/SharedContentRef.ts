import { fail, succeed, type Result } from '../../core/Result.js';
import type { ContentRefId, Email } from '../../value-objects/index.js';
import type { ContentRefProps } from './types.js';
import type { ActiveShare } from '../Share/ActiveShare.js';
import { BaseContentRef } from './BaseContentRef.js';

import type { ShareRole } from './SharedContentRef.types';
export type { ShareRole };



/**
 * SharedContentRef Entity
 *
 * Represents a content reference that has been shared with others.
 * Tracks active shares and supports sharing operations.
 */
export class SharedContentRef extends BaseContentRef {
  readonly kind = 'shared' as const;

  private constructor(
    props: ContentRefProps,
    private readonly _shares: ActiveShare[],
  ) {
    super(props);
  }

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

  get shares(): readonly ActiveShare[] { return [...this._shares]; }
}
