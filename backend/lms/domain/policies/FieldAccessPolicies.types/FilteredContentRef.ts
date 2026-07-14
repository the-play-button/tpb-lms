import type { Email } from '../../value-objects/index.js';
import type { DraftContentRef } from '../../entities/ContentRef/DraftContentRef.js';
import type { SharedContentRef } from '../../entities/ContentRef/SharedContentRef.js';
import type { ContentType, ContentUsage } from '../../entities/ContentRef/types.js';

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
