import type { Email } from '../value-objects/index.js';
import type { DraftContentRef } from '../entities/ContentRef/DraftContentRef.js';
import type { SharedContentRef } from '../entities/ContentRef/SharedContentRef.js';
import type { ContentType, ContentUsage } from '../entities/ContentRef/types.js';

import type { FilteredContentRef } from './FieldAccessPolicies.types/FilteredContentRef';
import type { FullContentRef } from './FieldAccessPolicies.types/FullContentRef';
export type { FilteredContentRef };
export type { FullContentRef };


/**
 * A filtered view of a ContentRef, safe for non-owner viewers.
 */

/**
 * Full view of a ContentRef, visible only to the owner.
 */

/**
 * Filters ContentRef fields based on whether the viewer is the owner.
 * Owners see all fields; other viewers see a restricted subset.
 */
export const filterContentRefFields = (contentRef: DraftContentRef | SharedContentRef, viewerEmail: Email): FilteredContentRef | FullContentRef => {
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
};
