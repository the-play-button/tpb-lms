import { log } from '@the-play-button/tpb-sdk-js';
import type { LmsActor } from '../../../types/HandlerContext.types.js';

export const createClassTrack = (actor: LmsActor, id: string): void => {
  log.info('[lms] class created', { id, actor: actor.bastionUserId ?? actor.type });
};
