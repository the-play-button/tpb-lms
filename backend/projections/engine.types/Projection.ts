import type { ProjectionKey } from './ProjectionKey';
import type { ProjectionState } from './ProjectionState';
import type { ProjectionEvent } from './ProjectionEvent';

export interface Projection {
    name: string;
    eventTypes: string[];
    getKey: (event: ProjectionEvent) => ProjectionKey;
    reduce: (state: ProjectionState, event: ProjectionEvent & { payload: unknown }) => ProjectionState;
}
