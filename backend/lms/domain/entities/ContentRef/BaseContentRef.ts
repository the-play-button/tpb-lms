import type { ContentRefId, ConnectionId, Email } from '../../value-objects/index.js';
import type { ContentRefProps, ContentType, ContentUsage } from './types.js';

export abstract class BaseContentRef {
  protected constructor(protected readonly props: ContentRefProps) {}

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

  toProps(): Readonly<ContentRefProps> {
    return { ...this.props };
  }
}
