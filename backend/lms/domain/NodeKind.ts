/**
 * NodeKind — the two structural kinds of an lms_class tree node (Plan 03
 * adjacency-list). SECTION = grouping folder, LESSON = leaf carrying media.
 * SSOT for the closed set, shared by the input schemas and the repository ports.
 */
export const NODE_KINDS = ['SECTION', 'LESSON'] as const;
export type NodeKind = (typeof NODE_KINDS)[number];
