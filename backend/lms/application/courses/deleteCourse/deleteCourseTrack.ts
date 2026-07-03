import { log } from '@the-play-button/tpb-sdk-js';
import type { LmsActor } from '../../../types/HandlerContext.js';

export const deleteCourseTrack = (actor: LmsActor, id: string): void => {
  log.info('[lms] course deleted', { id, actor: actor.email ?? actor.id });
};
