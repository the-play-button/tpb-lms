export interface DeletedView { id: string; deleted: boolean; subtree_count?: number; }

export const deleteCourseFilter = (row: DeletedView): DeletedView => row;
