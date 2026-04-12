import axios, { AxiosInstance } from 'axios';

type AzureTranslation = {
    text: string;
    to: string;
};

type AzureTranslateResponseItem = {
    translations: AzureTranslation[];
};

export class MicrosoftTranslatorClient {
    private readonly client: AxiosInstance;
    private readonly subscriptionKey: string;
    private readonly region: string;

    constructor(
        subscriptionKey?: string,
        region?: string,
        endpoint: string = 'https://api.cognitive.microsofttranslator.com/translate',
    ) {
        this.subscriptionKey = subscriptionKey ?? process.env.AZURE_TRANSLATOR_API_KEY ?? '';
        this.region = region ?? process.env.AZURE_TRANSLATOR_REGION ?? '';

        if (!this.subscriptionKey || !this.region) {
            throw new Error('Missing Azure Translator configuration');
        }

        this.client = axios.create({
            baseURL: endpoint,
            headers: {
                'Content-Type': 'application/json',
                'Ocp-Apim-Subscription-Key': this.subscriptionKey,
                'Ocp-Apim-Subscription-Region': this.region,
            },
        });
    }

    async translateText(text: string, from: string, to: string): Promise<string> {
        const response = await this.client.post<AzureTranslateResponseItem[]>('', [{ text }], {
            params: {
                'api-version': '3.0',
                from,
                to,
            },
        });

        return response.data?.[0]?.translations?.[0]?.text ?? '';
    }
}
