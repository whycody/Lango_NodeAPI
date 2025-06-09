import fetch from 'node-fetch';

export async function fetchNewWordsSuggestions(
  firstLang: string,
  secondLang: string,
  contextWords: string[],
  defaults: boolean = false
): Promise<{ word: string; translation: string }[]> {

  const langNames: Record<string, string> = {
    it: 'Italian',
    es: 'Spanish',
    pl: 'Polish',
    en: 'English',
    fr: 'French',
    de: 'German',
  };

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const contextExamples = contextWords
    .sort(() => Math.random() - 0.5)
    .slice(0, 20)
    .join(';');

  const fromLangName = langNames[firstLang];
  const toLangName = langNames[secondLang];

  const prompt = !defaults ? `Generate exactly 40 words in ${fromLangName} with their translations in ${toLangName} related to and in the level of these: ${contextExamples}. Important - do not include given words in your response. If any excluded word appears, regenerate the entire list until none appear. Include a mix of **nouns, adjectives, and verbs**. If the language has specific definite articles that are part of the word itself (like "el", "la", "los", "las" in Spanish), include them as part of the word. However, if the language uses a universal article (like "the" in English) that is not attached to the word itself, do not include it. For example: el libro - book; el amigo - friend; la mochila - backpack. Return ONLY a plain list in the format: word - translation; without spaces after semicolons, no new lines, no extra text.` :
    `Generate 40 ${contextWords.length >= 100 ? 'medium' : 'basic'}-level words in ${fromLangName} with translations in ${toLangName} language. Include a mix of **nouns, adjectives, and verbs**. If the language has specific definite articles that are part of the word itself (like "el", "la", "los", "las" in Spanish), include them as part of the word. However, if the language uses a universal article (like "the" in English) that is not attached to the word itself, do not  include it. For example: el libro - book; el amigo - friend; la mochila - backpack. Return ONLY a plain list in the format: word - translation; without spaces after semicolons, no new lines, no extra text. Strictly exclude the following words and any of their forms: ${contextExamples}. If any excluded word appears, regenerate the entire list until none appear.`

  console.log('Calling OpenAI API with prompt:', prompt);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 400,
    }),
  });

  const data = await response.json() as {
    choices: { message: { content: string } }[];
  };
  const text = data.choices[0].message.content;

  console.log('OpenAI response: ', text);

  return text
    .split(";")
    .filter(Boolean)
    .map((pair: string) => {
      const [word, translationRaw] = pair.split(" - ");
      const translation = translationRaw.trim().replace(/\.$/, '');
      return { word: word.trim(), translation };
    });
}