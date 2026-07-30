import { log } from '@the-play-button/tpb-sdk-js';
import type { LmsActor } from '../../../types/HandlerContext.types.js';

export const createCourseTrack = (actor: LmsActor, id: string): void => {
  log.info('[lms] course created', { id, actor: actor.bastionUserId ?? actor.type });
};
