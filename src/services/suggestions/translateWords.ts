import { GPTClient } from "../clients/GPTClient";
import { GPTReportAttr } from "../../types/models/GPTReportAttr";
import { TranslationItem } from "../../types/shared/TranslationItem";
import { buildTranslatingWordsPrompt } from "../../utils/promptBuilder";
import { LanguageCodeValue } from "../../constants/languageCodes";

const gptClient = new GPTClient();

export const translateWords = async (
  mainLangCode: LanguageCodeValue,
  translationLangCode: LanguageCodeValue,
  words: string[],
): Promise<{
  translations: TranslationItem[];
  fetchMetadata: GPTReportAttr;
}> => {
  const prompt = buildTranslatingWordsPrompt(
    mainLangCode,
    translationLangCode,
    words,
  );

  console.log("Calling with prompt:", prompt);

  const gptResponse = await gptClient.chat(prompt);

  console.log("GPT Response: ", gptResponse.data);

  const parsed: TranslationItem[] = JSON.parse(gptResponse.data || "[]");

  return {
    translations: parsed,
    fetchMetadata: {
      prompt,
      response: gptResponse.data || "",
      words: parsed,
      mainLang: mainLangCode,
      translationLang: translationLangCode,
      totalWords: words.length,
      tokensInput: gptResponse.tokensInput,
      tokensOutput: gptResponse.tokensOutput,
      costUSD: gptResponse.costUSD,
      aiModel: "gpt-4o-mini",
    },
  };
};
