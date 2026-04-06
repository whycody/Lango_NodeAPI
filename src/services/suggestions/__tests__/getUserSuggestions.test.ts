import { getSuggestionsForUser } from "../getUserSuggestions";
import { generateSuggestionsInBackground } from "../generateSuggestions";
import Suggestion from "../../../models/core/Suggestion";

jest.mock("../generateSuggestions");
jest.mock("../../../models/core/Suggestion");

const makeSuggestion = (overrides: Record<string, any> = {}) => ({
  _id: "suggestion1",
  __v: 0,
  userId: "user1",
  word: "casa",
  translation: "dom",
  lemma: "casa",
  lemmaId: "lemma1",
  mainLang: "it",
  translationLang: "pl",
  displayCount: 0,
  skipped: false,
  added: false,
  example: null,
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

describe("getSuggestionsForUser", () => {
  const userId = "user1";
  const mainLang = "it";
  const translationLang = "pl";

  beforeEach(() => {
    jest.clearAllMocks();
    (generateSuggestionsInBackground as jest.Mock).mockResolvedValue(undefined);
  });

  it("generates suggestions synchronously when active suggestions are below threshold", async () => {
    const suggestions = Array.from({ length: 5 }, (_, i) =>
      makeSuggestion({ _id: `s${i}` }),
    );

    (Suggestion.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(suggestions),
    });

    await getSuggestionsForUser(userId, mainLang, translationLang);

    expect(generateSuggestionsInBackground).toHaveBeenCalledWith(
      userId,
      mainLang,
      translationLang,
    );
    expect(Suggestion.find).toHaveBeenCalledTimes(2);
  });

  it("returns existing suggestions without awaiting generation when enough active suggestions exist", async () => {
    const suggestions = Array.from({ length: 25 }, (_, i) =>
      makeSuggestion({ _id: `s${i}`, displayCount: 0 }),
    );

    (Suggestion.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(suggestions),
    });

    const result = await getSuggestionsForUser(
      userId,
      mainLang,
      translationLang,
    );

    expect(result).toHaveLength(25);
    expect(Suggestion.find).toHaveBeenCalledTimes(1);
  });

  it("triggers background generation when most active suggestions have been displayed more than 3 times", async () => {
    const suggestions = Array.from({ length: 25 }, (_, i) =>
      makeSuggestion({ _id: `s${i}`, displayCount: 5 }),
    );

    (Suggestion.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(suggestions),
    });

    await getSuggestionsForUser(userId, mainLang, translationLang);

    expect(generateSuggestionsInBackground).toHaveBeenCalledWith(
      userId,
      mainLang,
      translationLang,
    );
  });

  it("does not trigger background generation when enough fresh suggestions exist", async () => {
    const suggestions = Array.from({ length: 25 }, (_, i) =>
      makeSuggestion({ _id: `s${i}`, displayCount: 1 }),
    );

    (Suggestion.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(suggestions),
    });

    await getSuggestionsForUser(userId, mainLang, translationLang);

    expect(generateSuggestionsInBackground).not.toHaveBeenCalled();
  });

  it("filters by since parameter when enough suggestions exist", async () => {
    const oldSuggestion = makeSuggestion({
      _id: "old",
      updatedAt: new Date("2025-01-01"),
    });
    const newSuggestion = makeSuggestion({
      _id: "new",
      updatedAt: new Date("2026-06-01"),
    });
    const suggestions = Array.from({ length: 20 }, (_, i) =>
      makeSuggestion({ _id: `s${i}`, displayCount: 0 }),
    );
    suggestions.push(oldSuggestion, newSuggestion);

    (Suggestion.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(suggestions),
    });

    const result = await getSuggestionsForUser(
      userId,
      mainLang,
      translationLang,
      "2026-03-01",
    );

    expect(
      result.every((s: any) => new Date(s.updatedAt) > new Date("2026-03-01")),
    ).toBe(true);
  });

  it("cleans suggestion by removing internal fields", async () => {
    const suggestions = [makeSuggestion()];

    (Suggestion.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(suggestions),
    });

    const result = await getSuggestionsForUser(
      userId,
      mainLang,
      translationLang,
    );

    expect(result[0]).toHaveProperty("id", "suggestion1");
    expect(result[0]._id).toBeUndefined();
    expect(result[0].__v).toBeUndefined();
    expect(result[0].lemma).toBeUndefined();
    expect(result[0].translationId).toBeNull();
  });

  it("excludes skipped and added suggestions from active count", async () => {
    const activeSuggestions = Array.from({ length: 10 }, (_, i) =>
      makeSuggestion({ _id: `active${i}` }),
    );
    const skippedSuggestions = Array.from({ length: 15 }, (_, i) =>
      makeSuggestion({ _id: `skipped${i}`, skipped: true }),
    );

    const allSuggestions = [...activeSuggestions, ...skippedSuggestions];

    (Suggestion.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue(allSuggestions),
    });

    await getSuggestionsForUser(userId, mainLang, translationLang);

    // 10 active < 20 threshold → synchronous generation
    expect(generateSuggestionsInBackground).toHaveBeenCalled();
    expect(Suggestion.find).toHaveBeenCalledTimes(2);
  });
});
