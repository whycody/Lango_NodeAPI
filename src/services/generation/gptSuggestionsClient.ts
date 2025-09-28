import { LanguageCodeValue } from "../../constants/languageCodes";
import { buildTranslatingWordsPrompt } from "../../utils/promptBuilder";
import fetch from "node-fetch";
import { parseWordPairs } from "../../utils/wordParser";
import { WordPair } from "../../types/WordPair";
import { FetchMetadata } from "../../types/FetchMetadata";

export const translateWords = async (mainLangCode: LanguageCodeValue, translationLangCode: LanguageCodeValue, words: string[]): Promise<{
  wordPairs: WordPair[],
  fetchMetadata: FetchMetadata
}> => {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) throw new Error("Missing OpenAI API key");

  const prompt = buildTranslatingWordsPrompt(mainLangCode, translationLangCode, words);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 400,
    }),
  });

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";
  const responseWords = parseWordPairs(text);

  const tokensInput = data.usage?.prompt_tokens;
  const tokensOutput = data.usage?.completion_tokens;
  const costUSD = tokensInput && tokensOutput
    ? (tokensInput / 1_000_000) * 0.60 + (tokensOutput / 1_000_000) * 2.40
    : undefined;

  return {
    wordPairs: responseWords,
    fetchMetadata: {
      prompt: prompt,
      words: responseWords,
      mainLang: mainLangCode,
      translationLang: translationLangCode,
      totalWords: words.length,
      tokensInput: tokensInput,
      tokensOutput: tokensOutput,
      costUSD: costUSD,
      aiModel: 'gpt-4o-mini'
    }
  }
}