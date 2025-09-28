import { Languages } from "../types/Language";
import { BaseWord } from "./baseWords";

export const languages: Languages = {
  pl: {
    languageCode: "pl",
    languageName: "Polish",
    definedArticles: null,
    exampleTranslations: {
      [BaseWord.Dog]: "pies",
      [BaseWord.ToSing]: "śpiewać",
      [BaseWord.Beautiful]: "ładny",
      [BaseWord.King]: "król",
      [BaseWord.ToRun]: "biegać",
      [BaseWord.Rich]: "bogaty",
    },
  },
  it: {
    languageCode: "it",
    languageName: "Italian",
    definedArticles: ["il", "lo", "la"],
    exampleTranslations: {
      [BaseWord.Dog]: "il cane",
      [BaseWord.ToSing]: "cantare",
      [BaseWord.Beautiful]: "bello",
      [BaseWord.King]: "il re",
      [BaseWord.ToRun]: "correre",
      [BaseWord.Rich]: "ricco",
    },
  },
  en: {
    languageCode: "en",
    languageName: "English",
    definedArticles: ["the"],
    exampleTranslations: {
      [BaseWord.Dog]: "dog",
      [BaseWord.ToSing]: "to sing",
      [BaseWord.Beautiful]: "beautiful",
      [BaseWord.King]: "king",
      [BaseWord.ToRun]: "to run",
      [BaseWord.Rich]: "rich",
    },
  },
  es: {
    languageCode: "es",
    languageName: "Spanish",
    definedArticles: ["el", "la"],
    exampleTranslations: {
      [BaseWord.Dog]: "el perro",
      [BaseWord.ToSing]: "cantar",
      [BaseWord.Beautiful]: "hermoso",
      [BaseWord.King]: "el rey",
      [BaseWord.ToRun]: "correr",
      [BaseWord.Rich]: "rico",
    },
  },
};