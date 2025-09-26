import { Languages } from "../types/Language";
import { BaseWord } from "./baseWords";

export const languages: Languages = {
  pl: {
    languageCode: "pl",
    languageName: "Polski",
    definedArticles: null,
    exampleTranslations: {
      [BaseWord.Dog]: { word: BaseWord.Dog, translation: "pies" },
      [BaseWord.ToSing]: { word: BaseWord.ToSing, translation: "śpiewać" },
      [BaseWord.Beautiful]: { word: BaseWord.Beautiful, translation: "ładny" },
      [BaseWord.King]: { word: BaseWord.King, translation: "król" },
      [BaseWord.ToRun]: { word: BaseWord.ToRun, translation: "biegać" },
      [BaseWord.Rich]: { word: BaseWord.Rich, translation: "bogaty" },
    },
  },
  it: {
    languageCode: "it",
    languageName: "Italiano",
    definedArticles: ["il", "lo", "la"],
    exampleTranslations: {
      [BaseWord.Dog]: { word: BaseWord.Dog, translation: "il cane" },
      [BaseWord.ToSing]: { word: BaseWord.ToSing, translation: "cantare" },
      [BaseWord.Beautiful]: { word: BaseWord.Beautiful, translation: "bello" },
      [BaseWord.King]: { word: BaseWord.King, translation: "il re" },
      [BaseWord.ToRun]: { word: BaseWord.ToRun, translation: "correre" },
      [BaseWord.Rich]: { word: BaseWord.Rich, translation: "ricco" },
    },
  },
  en: {
    languageCode: "en",
    languageName: "English",
    definedArticles: ["the"],
    exampleTranslations: {
      [BaseWord.Dog]: { word: BaseWord.Dog, translation: "dog" },
      [BaseWord.ToSing]: { word: BaseWord.ToSing, translation: "to sing" },
      [BaseWord.Beautiful]: { word: BaseWord.Beautiful, translation: "beautiful" },
      [BaseWord.King]: { word: BaseWord.King, translation: "king" },
      [BaseWord.ToRun]: { word: BaseWord.ToRun, translation: "to run" },
      [BaseWord.Rich]: { word: BaseWord.Rich, translation: "rich" },
    },
  },
  es: {
    languageCode: "es",
    languageName: "Español",
    definedArticles: ["el", "la"],
    exampleTranslations: {
      [BaseWord.Dog]: { word: BaseWord.Dog, translation: "el perro" },
      [BaseWord.ToSing]: { word: BaseWord.ToSing, translation: "cantar" },
      [BaseWord.Beautiful]: { word: BaseWord.Beautiful, translation: "hermoso" },
      [BaseWord.King]: { word: BaseWord.King, translation: "el rey" },
      [BaseWord.ToRun]: { word: BaseWord.ToRun, translation: "correr" },
      [BaseWord.Rich]: { word: BaseWord.Rich, translation: "rico" },
    },
  },
};