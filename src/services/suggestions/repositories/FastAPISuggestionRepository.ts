import { GetUserSuggestionsParams } from '../../../types/api/GetUserSuggestionsParams';
import { GetUserSuggestionsResponse } from '../../../types/api/GetUserSuggestionsResponse';
import { SuggestionsRepository } from '../../../types/api/SuggestionsRepository';
import { FastAPIClient } from '../../clients/FastAPIClient';

export class FastAPISuggestionsRepository implements SuggestionsRepository {
    private client: FastAPIClient;

    constructor(client?: FastAPIClient) {
        this.client = client || new FastAPIClient();
    }

    async getUserSuggestions(
        params: GetUserSuggestionsParams,
    ): Promise<GetUserSuggestionsResponse> {
        const { level, limit, mainLang, translationLang, userId } = params;
        return this.client.get<GetUserSuggestionsResponse>('/suggestions', {
            level,
            limit,
            main_lang: mainLang,
            translation_lang: translationLang,
            user_id: userId,
        });
    }
}
