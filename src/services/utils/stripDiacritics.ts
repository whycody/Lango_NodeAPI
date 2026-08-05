const MANUAL_REPLACEMENTS: Record<string, string> = {
    Đ: 'D',
    đ: 'd',
    Ł: 'L',
    ł: 'l',
    Ø: 'O',
    ø: 'o',
};

export function stripDiacritics(text: string): string {
    const manuallyReplaced = text.replace(/[ŁłØøĐđ]/g, char => MANUAL_REPLACEMENTS[char]);

    return manuallyReplaced.normalize('NFD').replace(/[̀-ͯ]/g, '');
}
