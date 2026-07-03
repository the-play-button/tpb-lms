export interface DeletedView { id: string; deleted: boolean; subtree_count?: number; }

export const deleteClassFilter = (row: DeletedView): DeletedView => row;
