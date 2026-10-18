import { withIdField } from '../utils/withIdField';

/** Strips backend-internal fields from a bundle before it is sent to clients. */
export const toBundleResponse = <T extends { _id: unknown }>(bundle: T) => {
    const {
        searchText: _searchText,
        themeInstanceId: _themeInstanceId,
        ...publicFields
    } = bundle as T & { searchText?: unknown; themeInstanceId?: unknown };

    return withIdField(publicFields);
};
