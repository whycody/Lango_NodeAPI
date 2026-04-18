import { LanguageCodeValue } from '../constants/languageCodes';
import { languages } from '../constants/languages';

export const buildTranslatingWordsPrompt = (
    mainLangCode: LanguageCodeValue,
    translationLangCode: LanguageCodeValue,
    words: string[],
) => {
    const mainLang = languages[mainLangCode];
    const translationLang = languages[translationLangCode];

    const mainLangHasArticles = mainLang.definedArticles && mainLang.definedArticles.length > 1;
    const translationLangHasArticles =
        translationLang.definedArticles && translationLang.definedArticles.length > 1;
    const bothLangsHaveArticles = mainLangHasArticles && translationLangHasArticles;

    let base = `You are a language learning assistant. Task: Process a list of words and return translations and examples. Rules: \n- `;

    const rules = [
        `CRITICAL: All translations and target of examples MUST be written exclusively in ${translationLang.languageName}`,
        'Keep output short and compact',
        'Use natural, common translations only; skip rare, archaic, or forced literal ones',
        'Add a second translation only if it has a significantly different meaning',
        'Do not include the source word in translations if real translations exist',
        'Mark isValid=false for: invalid words, proper names, overly technical terms, or identical non-borrowed words',
        'Max 1 example per word: a short, natural sentence showing how the word is used in context; no explanations unless invalid',
    ];

    base += rules.join(', \n- ') + '. ';

    if (bothLangsHaveArticles) {
        base += `For substantives include correct articles specified both for ${mainLang.languageName} (${mainLang.definedArticles}) and ${translationLang.languageName} (${translationLang.definedArticles}) languages. `;
    } else if (mainLangHasArticles) {
        base += `For substantives include correct articles specified for ${mainLang.languageName} language: ${mainLang.definedArticles}. `;
    } else if (translationLangHasArticles) {
        base += `For substantives include correct articles specified for ${translationLang.languageName} language: ${translationLang.definedArticles}. `;
    }

    base += `Return JSON array: [ { "source": string, "sourceArticle": string | null, "isValid": boolean, "translations": [string], "example": { "source": string, "target": string } | null } ]`;

    base += `Input: \n`;

    base += `language_from: ${mainLang.languageName}\n`;

    base += `language_to: ${translationLang.languageName}\n`;

    base += `words: ${JSON.stringify(words)}`;

    return base;
};
