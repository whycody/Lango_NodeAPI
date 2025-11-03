import { SuggestionAttr } from "../../types/models/SuggestionAttr";

export const mergeSuggestionFlags = (existing: SuggestionAttr, incoming: SuggestionAttr) => ({
  added: existing.added || incoming.added,
  skipped: existing.skipped || incoming.skipped,
});