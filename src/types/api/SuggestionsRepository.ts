import { GetUserSuggestionsParams } from './GetUserSuggestionsParams';
import { GetUserSuggestionsResponse } from './GetUserSuggestionsResponse';

export interface SuggestionsRepository {
    getUserSuggestions(params: GetUserSuggestionsParams): Promise<GetUserSuggestionsResponse>;
}
