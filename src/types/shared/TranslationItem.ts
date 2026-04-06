export type TranslationItem = {
  source: string;
  sourceArticle: string | null;
  isValid: boolean;
  translations: string[];
  example: {
    source: string;
    target: string;
  } | null;
};
