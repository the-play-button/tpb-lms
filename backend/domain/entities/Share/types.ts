// entropy-multiple-exports-ok: types module has 2 tightly-coupled exports sharing internal state
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
