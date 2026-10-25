import type { ActiveShare } from '../../entities/Share/ActiveShare.js';
import type { RevokedShare } from '../../entities/Share/RevokedShare.js';

export type Share = ActiveShare | RevokedShare;
