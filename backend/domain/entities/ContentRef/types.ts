// entropy-multiple-exports-ok: cohesive module exports
import type { ContentRefId, ConnectionId, Email } from '../../value-objects/index.js';

export type ContentType = 'markdown' | 'pitch' | 'pdf';
export type ContentUsage = 'intro' | 'step_document' | 'pitch_attachment';

export interface ContentRefProps {
  id: ContentRefId;
  connectionId: ConnectionId;
  fileId: string;
  name: string;
  contentType: ContentType;
  ownerEmail: Email;
  courseId: string | null;
  classId: string | null;
  usage: ContentUsage | null;
  lang: string;
  sourceRefId: ContentRefId | null;
  createdAt: Date;
  updatedAt: Date;
}
