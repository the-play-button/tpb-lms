import { fail, succeed, type Result } from '../core/Result.js';
import type { Email } from '../value-objects/index.js';
import type { DraftContentRef } from '../entities/ContentRef/DraftContentRef.js';
import type { SharedContentRef } from '../entities/ContentRef/SharedContentRef.js';

export interface Enrollment {
  learnerEmail: string;
  courseId: string;
  classId: string;
  active: boolean;
}
