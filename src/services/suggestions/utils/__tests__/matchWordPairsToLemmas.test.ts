import { LanguageCodeValue } from "../../../../constants/languageCodes";
import { LemmaAttrWithId } from "../../../../types/models/LemmaAttr";
import { WordPair } from "../../../../types/shared/WordPair";
import { matchWordPairsToLemmas } from "../matchWordPairsToLemmas";

describe("matchWordPairsToLemmas", () => {
  const mainLangCode: LanguageCodeValue = "it";

  const lemmas: LemmaAttrWithId[] = [
    { _id: "1", lemma: "amico", type: "subst", lang: "it", prefix: "", freq: 1, freq_z: 0 },
    { _id: "2", lemma: "cane", type: "subst", lang: "it", prefix: "", freq: 1, freq_z: 0 },
    { _id: "3", lemma: "gatto", type: "subst", lang: "it", prefix: "", freq: 1, freq_z: 0 },
    { _id: "4", lemma: "cantare", type: "verb", lang: "it", prefix: "", freq: 1, freq_z: 0 },
  ];

  it("matches word with apostrophe article", () => {
    const wordPairs: WordPair[] = [
      { word: "l'amico", translation: "przyjaciel" },
    ];

    const result = matchWordPairsToLemmas(wordPairs, lemmas, mainLangCode);

    expect(result).toEqual([
      {
        lemmaId: "1",
        lemma: "amico",
        word: "l'amico",
        translation: "przyjaciel",
        prefix: "l'",
      },
    ]);
  });

  it("matches word with standard article", () => {
    const wordPairs: WordPair[] = [
      { word: "il cane", translation: "pies" },
    ];

    const result = matchWordPairsToLemmas(wordPairs, lemmas, mainLangCode);

    expect(result).toEqual([
      {
        lemmaId: "2",
        lemma: "cane",
        word: "il cane",
        translation: "pies",
        prefix: "il ",
      },
    ]);
  });

  it("matches word without article", () => {
    const wordPairs: WordPair[] = [
      { word: "gatto", translation: "kot" },
    ];

    const result = matchWordPairsToLemmas(wordPairs, lemmas, mainLangCode);

    expect(result).toEqual([
      {
        lemmaId: "3",
        lemma: "gatto",
        word: "gatto",
        translation: "kot",
        prefix: null,
      },
    ]);
  });

  it("matches verbs without article", () => {
    const wordPairs: WordPair[] = [
      { word: "cantare", translation: "śpiewać" },
    ];

    const result = matchWordPairsToLemmas(wordPairs, lemmas, mainLangCode);

    expect(result).toEqual([
      {
        lemmaId: "4",
        lemma: "cantare",
        word: "cantare",
        translation: "śpiewać",
        prefix: null,
      },
    ]);
  });

  it("ignores words that do not match any lemma", () => {
    const wordPairs: WordPair[] = [
      { word: "nonmatching", translation: "brak" },
    ];

    const result = matchWordPairsToLemmas(wordPairs, lemmas, mainLangCode);

    expect(result).toEqual([]);
  });

  it("is case-insensitive", () => {
    const wordPairs: WordPair[] = [
      { word: "L'Amico", translation: "przyjaciel" },
    ];

    const result = matchWordPairsToLemmas(wordPairs, lemmas, mainLangCode);

    expect(result).toEqual([
      {
        lemmaId: "1",
        lemma: "amico",
        word: "L'Amico",
        translation: "przyjaciel",
        prefix: "l'",
      },
    ]);
  });
});
