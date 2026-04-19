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

/**
 * A learner must be actively enrolled in the class to access its content.
 */
export const enrolledLearnerPolicy = (enrollment: Enrollment | null): Result<string, 'allowed'> => {
  if (!enrollment) {
    return fail('Learner is not enrolled');
  }
  if (!enrollment.active) {
    return fail('Learner enrollment is not active');
  }
  return succeed('allowed' as const);
};

/**
 * The owner of a content ref always has access.
 */
export const ownerAccessPolicy = (contentRef: DraftContentRef | SharedContentRef, userEmail: Email): Result<string, 'allowed'> => {
  if (!contentRef.ownerEmail.equals(userEmail)) {
    return fail('User is not the owner of this content');
  }
  return succeed('allowed' as const);
};
