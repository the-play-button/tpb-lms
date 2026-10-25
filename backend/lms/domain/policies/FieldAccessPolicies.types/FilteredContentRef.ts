import type { ContentType, ContentUsage } from '../../entities/ContentRef/ContentRef.types.js';

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
