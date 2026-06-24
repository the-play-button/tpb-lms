import type { Email } from '../../value-objects/index.js';
import type { RevokedShareProps } from './types.js';
import { BaseShare } from './BaseShare.js';

/**
 * RevokedShare Entity (read-only)
 *
 * Represents a sharing relationship that has been revoked.
 * Immutable -- no commands, only queries.
 */
export class RevokedShare extends BaseShare<RevokedShareProps> {
  readonly kind = 'revoked' as const;

  private constructor(props: RevokedShareProps) {
    super(props);
  }

  static reconstitute(props: RevokedShareProps): RevokedShare {
    return new RevokedShare(props);
  }

  get revokedAt(): Date { return this.props.revokedAt; }
  get revokedByEmail(): Email { return this.props.revokedByEmail; }
}
