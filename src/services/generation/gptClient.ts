import fetch from 'node-fetch';

type WordPair = { word: string; translation: string };
type FetchMetadata = {
  prompt: string;
  words: string[];
  excludedWords: string[];
  totalWords: number;
  hasExcludedWords: boolean;
  tokensInput?: number;
  tokensOutput?: number;
  costUSD?: number;
  model: string;
  success: boolean;
};

const langNames: Record<string, string> = {
  it: 'Italian',
  es: 'Spanish',
  pl: 'Polish',
  en: 'English',
  fr: 'French',
  de: 'German',
};

function buildPrompt({ firstLang, secondLang, contextWords, defaults }: {
  firstLang: string;
  secondLang: string;
  contextWords: string[];
  defaults: boolean;
}): string {

  const contextExamples = contextWords
    .sort(() => Math.random() - 0.5)
    .slice(0, 20)
    .join(';');

  const fromLangName = langNames[firstLang];
  const toLangName = langNames[secondLang];

  const base = `Include a mix of **nouns, adjectives, and verbs**. If the language has specific definite articles that are part of the word itself (like "el", "la", "los", "las" in Spanish), include them as part of the word. However, if the language uses a universal article (like "the" in English) that is not attached to the word itself, do not include it. For example: el libro - book; el amigo - friend; la mochila - backpack. Return ONLY a plain list in the format: word - translation; without spaces after semicolons, no new lines, no extra text.`;

  if (!defaults) {
    return `Generate exactly 40 words in ${fromLangName} with their translations in ${toLangName} related to and in the level of these: ${contextExamples}. Important - do not include given words in your response. If any excluded word appears, regenerate the entire list until none appear. ${base}`;
  }

  return `Generate 40 ${contextWords.length >= 100 ? 'medium' : 'basic'}-level words in ${fromLangName} with translations in ${toLangName} language. ${base} Strictly exclude the following words and any of their forms: ${contextExamples}. If any excluded word appears, regenerate the entire list until none appear.`;
}

function parseResponseText(text: string): WordPair[] {
  return text
    .split(";")
    .filter(Boolean)
    .map(pair => {
      const [word, translationRaw] = pair.split(" - ");
      const translation = translationRaw?.trim().replace(/\.$/, '') ?? '';
      return { word: word?.trim(), translation };
    })
    .filter(w => w.word && w.translation);
}

function detectExcludedWords(words: string[], excludedWords: string[]): boolean {
  return words.some(w =>
    excludedWords.some(ex => w.toLowerCase().includes(ex.toLowerCase()))
  );
}

export async function fetchNewWordsSuggestions(
  firstLang: string,
  secondLang: string,
  contextWords: string[],
  defaults = false,
  model = "gpt-4o-mini"
): Promise<{ words: WordPair[]; metadata: FetchMetadata }> {

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) throw new Error("Missing OpenAI API key");

  const prompt = buildPrompt({ firstLang, secondLang, contextWords, defaults });

  console.log("Calling OpenAI API with prompt:", prompt);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 400,
    }),
  });

  const data = await response.json();

  const text = data.choices?.[0]?.message?.content || "";
  const words = parseResponseText(text);

  const excludedWords = contextWords.map(w => w.toLowerCase());
  const hasExcludedWords = detectExcludedWords(words.map(w => w.word), excludedWords);

  const tokensInput = data.usage?.prompt_tokens;
  const tokensOutput = data.usage?.completion_tokens;
  const costUSD = tokensInput && tokensOutput
    ? (tokensInput / 1_000_000) * 0.60 + (tokensOutput / 1_000_000) * 2.40
    : undefined;

  return {
    words,
    metadata: {
      prompt,
      words: words.map(w => w.word),
      excludedWords,
      totalWords: words.length,
      hasExcludedWords,
      tokensInput,
      tokensOutput,
      costUSD,
      model,
      success: !hasExcludedWords
    },
  };
}