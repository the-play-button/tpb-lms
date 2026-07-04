/**
 * AuthoringContext — injected into the content-authoring CRUD pipeline
 * (create/update/delete of lms_course + lms_class).
 *
 * Leaner than the BYOC HandlerContext: authoring authorizes via PBAC literal
 * scope checks on the actor (hasScope), not ReBAC delegated authz (cf. CLAUDE.md
 * § AUTHZ — PBAC FIRST). No storage/pam/connection ports needed.
 */
import type { LmsActor } from './HandlerContext.js';
import type { LmsCourseRepository } from '../domain/repositories/LmsCourseRepository.js';
import type { LmsClassRepository } from '../domain/repositories/LmsClassRepository.js';

export interface AuthoringContext {
  db: D1Database;
  actor: LmsActor;
  userEmail: string;
  courseRepo: LmsCourseRepository;
  classRepo: LmsClassRepository;
}
