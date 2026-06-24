import type { ShareId, ContentRefId, Email } from '../../value-objects/index.js';
import type { ShareRole } from '../ContentRef/SharedContentRef.js';
import type { ShareProps } from './types.js';

export abstract class BaseShare<TProps extends ShareProps = ShareProps> {
  protected constructor(protected readonly props: TProps) {}

  get id(): ShareId { return this.props.id; }
  get contentRefId(): ContentRefId { return this.props.contentRefId; }
  get sharedByEmail(): Email { return this.props.sharedByEmail; }
  get sharedWithEmail(): Email { return this.props.sharedWithEmail; }
  get role(): ShareRole { return this.props.role; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  toProps(): Readonly<TProps> {
    return { ...this.props };
  }
}
