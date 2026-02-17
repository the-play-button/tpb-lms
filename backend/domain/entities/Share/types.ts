// entropy-multiple-exports-ok: cohesive module exports
import type { ShareId, ContentRefId, Email } from '../../value-objects/index.js';
import type { ShareRole } from '../ContentRef/SharedContentRef.js';

export interface ShareProps {
  id: ShareId;
  contentRefId: ContentRefId;
  sharedByEmail: Email;
  sharedWithEmail: Email;
  role: ShareRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface RevokedShareProps extends ShareProps {
  revokedAt: Date;
  revokedByEmail: Email;
}
