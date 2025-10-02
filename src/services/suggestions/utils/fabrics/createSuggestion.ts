import { SuggestionAttr } from "../../../../types/models/SuggestionAttr";
import { PartialBy } from "../../../../types/helpers/PartialBy";

type SuggestionDefaults = "skipped" | "added" | "displayCount";

export const createSuggestion = (attrs: PartialBy<SuggestionAttr, SuggestionDefaults>): SuggestionAttr => ({
  skipped: false,
  added: false,
  displayCount: 0,
  ...attrs,
});