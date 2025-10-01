import { GPTClient } from "../clients/GPTClient";
import { WordPair } from "../../types/shared/WordPair";
import { GPTReportAttr } from "../../types/models/GPTReportAttr";
import { buildTranslatingWordsPrompt } from "../../utils/promptBuilder";
import { parseWordPairs } from "../../utils/wordParser";
import { LanguageCodeValue } from "../../constants/languageCodes";

const gptClient = new GPTClient();

export const translateWords = async (mainLangCode: LanguageCodeValue, translationLangCode: LanguageCodeValue, words: string[]): Promise<{
  wordPairs: WordPair[],
  fetchMetadata: GPTReportAttr
}> => {
  const prompt = buildTranslatingWordsPrompt(mainLangCode, translationLangCode, words);

  console.log('Calling with prompt:', prompt);

  const gptResponse = await gptClient.chat<string>(prompt);

  console.log('GPT Response: ', gptResponse.data);

  const responseWords = parseWordPairs(gptResponse.data || "");

  return {
    wordPairs: responseWords,
    fetchMetadata: {
      prompt,
      response: gptResponse.data || "",
      words: responseWords,
      mainLang: mainLangCode,
      translationLang: translationLangCode,
      totalWords: words.length,
      tokensInput: gptResponse.tokensInput,
      tokensOutput: gptResponse.tokensOutput,
      costUSD: gptResponse.costUSD,
      aiModel: 'gpt-4o-mini',
    }
  };
};