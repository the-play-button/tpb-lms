import type { Email } from '../value-objects/index.js';
import type { DraftContentRef } from '../entities/ContentRef/DraftContentRef.js';
import type { SharedContentRef } from '../entities/ContentRef/SharedContentRef.js';
import type { ContentType, ContentUsage } from '../entities/ContentRef/types.js';

/**
 * A filtered view of a ContentRef, safe for non-owner viewers.
 */
export interface FilteredContentRef {
  id: string;
  fileId: string;
  name: string;
  contentType: ContentType;
  courseId: string | null;
  classId: string | null;
  usage: ContentUsage | null;
  lang: string;
}

/**
 * Full view of a ContentRef, visible only to the owner.
 */
export interface FullContentRef extends FilteredContentRef {
  connectionId: string;
  ownerEmail: string;
  sourceRefId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Filters ContentRef fields based on whether the viewer is the owner.
 * Owners see all fields; other viewers see a restricted subset.
 */
export function filterContentRefFields(
  contentRef: DraftContentRef | SharedContentRef,
  viewerEmail: Email,
): FilteredContentRef | FullContentRef {
  const isOwner = contentRef.ownerEmail.equals(viewerEmail);

  const base: FilteredContentRef = {
    id: contentRef.id.toString(),
    fileId: contentRef.fileId,
    name: contentRef.name,
    contentType: contentRef.contentType,
    courseId: contentRef.courseId,
    classId: contentRef.classId,
    usage: contentRef.usage,
    lang: contentRef.lang,
  };

  if (!isOwner) {
    return base;
  }

  return {
    ...base,
    connectionId: contentRef.connectionId.toString(),
    ownerEmail: contentRef.ownerEmail.toString(),
    sourceRefId: contentRef.sourceRefId?.toString() ?? null,
    createdAt: contentRef.createdAt,
    updatedAt: contentRef.updatedAt,
  };
}
