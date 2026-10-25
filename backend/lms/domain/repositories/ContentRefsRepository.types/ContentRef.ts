import type { DraftContentRef } from '../../entities/ContentRef/DraftContentRef.js';
import type { SharedContentRef } from '../../entities/ContentRef/SharedContentRef.js';

export type ContentRef = DraftContentRef | SharedContentRef;
