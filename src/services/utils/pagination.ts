export const parsePagination = (
    limit: unknown,
    offset: unknown,
    { defaultLimit = 20, maxLimit = 50 } = {},
): { resultLimit: number; resultOffset: number } => {
    const parsedLimit = Number(limit);
    const resultLimit =
        Number.isInteger(parsedLimit) && parsedLimit > 0
            ? Math.min(parsedLimit, maxLimit)
            : defaultLimit;

    const parsedOffset = Number(offset);
    const resultOffset = Number.isInteger(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0;

    return { resultLimit, resultOffset };
};
