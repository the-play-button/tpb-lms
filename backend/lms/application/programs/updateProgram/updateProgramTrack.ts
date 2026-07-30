import { log } from '@the-play-button/tpb-sdk-js';
import type { LmsActor } from '../../../types/HandlerContext.types.js';

export const updateProgramTrack = (actor: LmsActor, id: string): void => {
  log.info('[lms] program updated', { id, actor: actor.bastionUserId ?? actor.type });
};
