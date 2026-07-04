/**
 * createAuthoringContext — JS/TS bridge for the content-authoring CRUD routes.
 *
 * Called from index.js for POST/PATCH/DELETE /api/courses + /api/classes.
 * Builds the AuthoringContext (D1 + actor + repositories).
 */
import type { AuthoringContext } from '../lms/types/AuthoringContext.js';
import type { LmsActor } from '../lms/types/HandlerContext.js';
import type { Env } from '../types/Env.js';
import { LmsCourseDatabaseRepository } from '../lms/infrastructure/repositories/LmsCourseDatabaseRepository.js';
import { LmsClassDatabaseRepository } from '../lms/infrastructure/repositories/LmsClassDatabaseRepository.js';

interface UserContext {
  user: { email: string };
}

export const createAuthoringContext = (
  _request: Request,
  env: Env,
  userContext: UserContext,
  actor: LmsActor,
): AuthoringContext => ({
  db: env.DB,
  actor,
  userEmail: userContext.user.email,
  courseRepo: new LmsCourseDatabaseRepository(env.DB),
  classRepo: new LmsClassDatabaseRepository(env.DB),
});
