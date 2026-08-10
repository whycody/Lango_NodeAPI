export const withIdField = <T extends object & { _id: unknown }>(
    doc: T,
): Omit<T, '_id'> & { id: T['_id'] } => ({
    ...doc,
    _id: undefined,
    id: doc._id,
});
