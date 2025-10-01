import { GetUserSuggestionsResponse } from "./GetUserSuggestionsResponse";
import { GetUserSuggestionsParams } from "./GetUserSuggestionsParams";

export interface SuggestionsRepository {
  getUserSuggestions(
    params: GetUserSuggestionsParams
  ): Promise<GetUserSuggestionsResponse>;
}
