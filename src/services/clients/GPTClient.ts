import fetch from "node-fetch";

export interface GptResponse<T> {
  data: T;
  tokensInput?: number;
  tokensOutput?: number;
  costUSD?: number;
  model?: GptModel;
}

export type GptModel = 'gpt-4o-mini' | 'gpt-3.5-turbo' | 'gpt-4o';

export class GPTClient {
  private readonly apiKey: string;
  private defaultModel: GptModel = 'gpt-4o-mini';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || "";
    if (!this.apiKey) throw new Error("Missing OpenAI API key");
  }

  async chat<T>(prompt: string, model?: GptModel): Promise<GptResponse<T>> {
    const usedModel = model || this.defaultModel;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: usedModel,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();

    const tokensInput = data.usage?.prompt_tokens;
    const tokensOutput = data.usage?.completion_tokens;
    const costUSD = tokensInput && tokensOutput
      ? (tokensInput / 1_000_000) * 0.60 + (tokensOutput / 1_000_000) * 2.40
      : undefined;

    return {
      data: data.choices?.[0]?.message?.content,
      tokensInput,
      tokensOutput,
      costUSD,
      model: usedModel,
    };
  }
}