import { FastAPIClient } from "../../clients/FastAPIClient";
import { GetUserSuggestionsResponse } from "../../../types/api/GetUserSuggestionsResponse";
import { SuggestionsRepository } from "../../../types/api/SuggestionsRepository";
import { GetUserSuggestionsParams } from "../../../types/api/GetUserSuggestionsParams";

export class FastAPISuggestionsRepository implements SuggestionsRepository {
  private client: FastAPIClient;

  constructor(client?: FastAPIClient) {
    this.client = client || new FastAPIClient();
  }

  async getUserSuggestions(params: GetUserSuggestionsParams): Promise<GetUserSuggestionsResponse> {
    const { userId, mainLang, translationLang, limit } = params;
    return this.client.get<GetUserSuggestionsResponse>("/suggestions", {
      user_id: userId,
      main_lang: mainLang,
      translation_lang: translationLang,
      limit,
    });
  }
}