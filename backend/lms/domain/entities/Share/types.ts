// entropy-one-export-per-types-file-ok: cohesive Share entity prop module (ShareProps + RevokedShareProps extends ShareProps — the second literally extends the first, inseparable)
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
