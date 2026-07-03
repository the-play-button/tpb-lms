import { log } from '@the-play-button/tpb-sdk-js';
import type { LmsActor } from '../../../types/HandlerContext.js';

export const deleteClassTrack = (actor: LmsActor, id: string): void => {
  log.info('[lms] class deleted', { id, actor: actor.email ?? actor.id });
};
