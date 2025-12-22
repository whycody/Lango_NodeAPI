import axios, { AxiosInstance } from 'axios';

export type GptModel = 'gpt-4o-mini' | 'gpt-3.5-turbo' | 'gpt-4o';

type OpenAIChatResponse = {
  choices: {
    message: {
      content: string;
    };
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
};

export type GptResponse<T> = {
  data: T | null;
  tokensInput?: number;
  tokensOutput?: number;
  costUSD?: number;
  model: GptModel;
};

type ModelPricing = {
  inputPerMTokens: number;
  outputPerMTokens: number;
};

const MODEL_PRICING: Record<GptModel, ModelPricing> = {
  'gpt-4o-mini': { inputPerMTokens: 0.6, outputPerMTokens: 2.4 },
  'gpt-4o': { inputPerMTokens: 5, outputPerMTokens: 15 },
  'gpt-3.5-turbo': { inputPerMTokens: 0.5, outputPerMTokens: 1.5 },
};

export class GPTClient {
  private readonly axios: AxiosInstance;
  private readonly defaultModel: GptModel;

  constructor(apiKey?: string, defaultModel: GptModel = 'gpt-4o-mini') {
    const resolvedKey = apiKey ?? process.env.OPENAI_API_KEY ?? '';
    if (!resolvedKey) throw new Error('Missing OpenAI API key');

    this.defaultModel = defaultModel;

    this.axios = axios.create({
      baseURL: 'https://api.openai.com/v1',
      headers: {
        'Authorization': `Bearer ${resolvedKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async chat<T = string>(prompt: string, model?: GptModel): Promise<GptResponse<T>> {
    const usedModel = model ?? this.defaultModel;

    const { data } = await this.axios.post<OpenAIChatResponse>(
      '/chat/completions',
      {
        model: usedModel,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      },
    );

    const tokensInput = data.usage?.prompt_tokens;
    const tokensOutput = data.usage?.completion_tokens;

    const pricing = MODEL_PRICING[usedModel];

    const costUSD =
      tokensInput !== undefined && tokensOutput !== undefined
        ? (tokensInput / 1_000_000) * pricing.inputPerMTokens +
        (tokensOutput / 1_000_000) * pricing.outputPerMTokens
        : undefined;

    return {
      data: (data.choices?.[0]?.message?.content as T) ?? null,
      tokensInput,
      tokensOutput,
      costUSD,
      model: usedModel,
    };
  }
}