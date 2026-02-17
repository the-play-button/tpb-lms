// entropy-class-method-length-ok: DDD entity — factory create() with 3 field validations + 10 nullable params + reconstitute + 12 property getters, coupled by ContentRefProps invariant
import { fail, succeed, type Result } from '../../core/Result.js';
import type { ContentRefId, ConnectionId, Email } from '../../value-objects/index.js';
import type { ContentRefProps, ContentType, ContentUsage } from './types.js';

/**
 * DraftContentRef Entity
 *
 * Represents a content reference that has not been shared yet.
 * Only the owner can access a draft content ref.
 */
export class DraftContentRef {
  readonly kind = 'draft' as const;

  private constructor(private readonly props: ContentRefProps) {}

  static create(params: {
    id: ContentRefId;
    connectionId: ConnectionId;
    fileId: string;
    name: string;
    contentType: ContentType;
    ownerEmail: Email;
    lang: string;
    courseId?: string | null;
    classId?: string | null;
    usage?: ContentUsage | null;
    sourceRefId?: ContentRefId | null;
  }): Result<string, DraftContentRef> {
    if (!params.fileId || params.fileId.trim() === '') {
      return fail('fileId cannot be empty');
    }
    if (!params.name || params.name.trim() === '') {
      return fail('name cannot be empty');
    }
    if (!params.lang || params.lang.trim() === '') {
      return fail('lang cannot be empty');
    }

    const now = new Date();
    return succeed(
      new DraftContentRef({
        id: params.id,
        connectionId: params.connectionId,
        fileId: params.fileId.trim(),
        name: params.name.trim(),
        contentType: params.contentType,
        ownerEmail: params.ownerEmail,
        courseId: params.courseId ?? null,
        classId: params.classId ?? null,
        usage: params.usage ?? null,
        lang: params.lang.trim(),
        sourceRefId: params.sourceRefId ?? null,
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  static reconstitute(props: ContentRefProps): DraftContentRef {
    return new DraftContentRef(props);
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

  /**
   * Returns a plain-object snapshot of all properties.
   * Useful for persistence and serialization.
   */
  toProps(): Readonly<ContentRefProps> {
    return { ...this.props };
  }
}
