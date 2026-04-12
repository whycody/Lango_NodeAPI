export type MatchPair = {
    lemmaId: string;
    lemma: string;
    word: string;
    isValid: boolean;
    example: {
        source: string;
        target: string;
    } | null;
    translation: string | null;
    prefix: string | null;
};
