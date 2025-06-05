import fetch from 'node-fetch';

export async function fetchNewWordsSuggestions(
  firstLang: string,
  secondLang: string,
  contextWords: string[]
): Promise<{ word: string; translation: string }[]> {

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const contextExamples = contextWords.slice(0, 10).join(';');
  const prompt = `Generate exactly 30 words in ${firstLang} with their translations in ${secondLang} related to and 
  in the level of these: ${contextExamples}. Include a mix of **nouns, adjectives, and verbs**. If the language has specific 
  definite articles that are part of the word itself (like "el", "la", "los", "las" in Spanish), include them as part of the word. 
  However, if the language uses a universal article (like "the" in English) that is not attached to the word itself, do not 
  include it. Return ONLY a plain list in the format: word - translation; without spaces after semicolons, no new lines,
  no extra text. Do NOT repeat words given in context.`;

  console.log('Calling OpenAI API with prompt:', prompt);
  console.log(OPENAI_API_KEY)

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