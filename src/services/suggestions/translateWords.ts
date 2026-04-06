import { GPTClient } from "../clients/GPTClient";
import { GPTReportAttr } from "../../types/models/GPTReportAttr";
import { TranslationItem } from "../../types/shared/TranslationItem";
import { buildTranslatingWordsPrompt } from "../../utils/promptBuilder";
import { LanguageCodeValue } from "../../constants/languageCodes";

const gptClient = new GPTClient();

function tryParse(data: string | null): TranslationItem[] | null {
  try {
    return JSON.parse(data || "[]");
  } catch {
    return null;
  }
}

export const translateWords = async (
  mainLangCode: LanguageCodeValue,
  translationLangCode: LanguageCodeValue,
  words: string[],
) => {
  const prompt = buildTranslatingWordsPrompt(
    mainLangCode,
    translationLangCode,
    words,
  );

  let response = await gptClient.chat(prompt);
  let parsed = tryParse(response.data);

  if (!parsed) {
    console.error("Failed to parse GPT response, retrying...", response.data);
    response = await gptClient.chat(prompt);
    parsed = tryParse(response.data);
  }

  if (!parsed) {
    console.error("Retry failed, returning empty translations.", response.data);
    parsed = [];
  }

  const metadata: GPTReportAttr = {
    prompt,
    response: response.data || "",
    words: parsed,
    mainLang: mainLangCode,
    translationLang: translationLangCode,
    totalWords: words.length,
    tokensInput: response.tokensInput,
    tokensOutput: response.tokensOutput,
    costUSD: response.costUSD,
    aiModel: "gpt-4o-mini",
  };

  return { translations: parsed, fetchMetadata: metadata };
};
