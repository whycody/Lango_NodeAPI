import { translateWords } from "../translateWords";
import { buildTranslatingWordsPrompt } from "../../../utils/promptBuilder";
import { GPTClient } from "../../clients/GPTClient";

jest.mock("../../../utils/promptBuilder");

const mockChat = jest.fn();

jest.mock("../../clients/GPTClient", () => ({
  GPTClient: jest.fn().mockImplementation(() => ({
    chat: (...args: unknown[]) => mockChat(...args),
  })),
}));

describe("translateWords", () => {
  const mainLang = "it";
  const translationLang = "pl";

  beforeEach(() => {
    jest.clearAllMocks();
    (buildTranslatingWordsPrompt as jest.Mock).mockReturnValue("mocked-prompt");
  });

  it("parses GPT JSON response into TranslationItem array", async () => {
    const gptData = [
      {
        source: "casa",
        sourceArticle: "la",
        isValid: true,
        translations: ["dom"],
        example: { source: "La casa è grande.", target: "Dom jest duży." },
      },
    ];

    mockChat.mockResolvedValue({
      data: JSON.stringify(gptData),
      tokensInput: 100,
      tokensOutput: 50,
      costUSD: 0.001,
    });

    const result = await translateWords(mainLang, translationLang, ["casa"]);

    expect(result.translations).toEqual(gptData);
    expect(buildTranslatingWordsPrompt).toHaveBeenCalledWith(
      mainLang,
      translationLang,
      ["casa"],
    );
  });

  it("returns empty array when GPT returns null", async () => {
    mockChat.mockResolvedValue({
      data: null,
      tokensInput: 10,
      tokensOutput: 0,
    });

    const result = await translateWords(mainLang, translationLang, ["xyz"]);

    expect(result.translations).toEqual([]);
  });

  it("populates fetchMetadata correctly", async () => {
    const gptData = [
      {
        source: "cane",
        sourceArticle: "il",
        isValid: true,
        translations: ["pies"],
        example: null,
      },
    ];

    mockChat.mockResolvedValue({
      data: JSON.stringify(gptData),
      tokensInput: 200,
      tokensOutput: 80,
      costUSD: 0.002,
    });

    const result = await translateWords(mainLang, translationLang, [
      "cane",
      "gatto",
    ]);

    expect(result.fetchMetadata).toEqual({
      prompt: "mocked-prompt",
      response: JSON.stringify(gptData),
      words: gptData,
      mainLang,
      translationLang,
      totalWords: 2,
      tokensInput: 200,
      tokensOutput: 80,
      costUSD: 0.002,
      aiModel: "gpt-4o-mini",
    });
  });

  it("retries once and returns empty array when GPT returns invalid JSON both times", async () => {
    mockChat.mockResolvedValue({
      data: "not valid json",
      tokensInput: 10,
      tokensOutput: 5,
    });

    const result = await translateWords(mainLang, translationLang, ["casa"]);

    expect(result.translations).toEqual([]);
    expect(mockChat).toHaveBeenCalledTimes(2);
  });

  it("returns parsed result on retry when first attempt fails", async () => {
    const gptData = [
      {
        source: "casa",
        sourceArticle: "la",
        isValid: true,
        translations: ["dom"],
        example: null,
      },
    ];

    mockChat
      .mockResolvedValueOnce({
        data: "bad json",
        tokensInput: 10,
        tokensOutput: 5,
      })
      .mockResolvedValueOnce({
        data: JSON.stringify(gptData),
        tokensInput: 100,
        tokensOutput: 50,
        costUSD: 0.001,
      });

    const result = await translateWords(mainLang, translationLang, ["casa"]);

    expect(result.translations).toEqual(gptData);
    expect(mockChat).toHaveBeenCalledTimes(2);
  });
});
