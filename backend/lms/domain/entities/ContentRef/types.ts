import type { ContentRefId, ConnectionId, Email } from '../../value-objects/index.js';

// entropy-enum-design-audit-ok: ContentType = closed enum on content format axis only (no vendor names, no mixed abstraction, no model duplication). The 3 members map 1:1 to renderer pipelines (markdown → marked.parse, pitch → tally-form embed, pdf → pdf.js viewer). Adding a new format requires a renderer + storage adapter — schema bump is the correct gate. Vendor neutrality enforced.
export type ContentType = 'markdown' | 'pitch' | 'pdf';
// entropy-enum-design-audit-ok: ContentUsage = closed enum on lifecycle-role axis (intro vs step_document vs pitch_attachment). All 3 members are LMS-domain roles, no vendor / brand / SaaS names. Each role drives different placement in the course shell — adding a new role implies new shell logic + UI surface, schema bump is the correct gate. Mixed abstraction nil : all 3 are placement contexts.
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
