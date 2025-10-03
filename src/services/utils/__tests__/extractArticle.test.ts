import { ExtractedArticle } from "../../../types/shared/ExtractedArticle";
import { extractPrefix } from "../extractPrefix";
import { languages } from "../../../constants/languages";
import { LanguageCode } from "../../../constants/languageCodes";

describe("extractPrefix", () => {
  const articles = languages[LanguageCode.It].definedArticles!;

  it("extracts article for word with apostrophe", () => {
    const result: ExtractedArticle = extractPrefix("l'amico", "amico", articles);
    expect(result).toEqual({ articleFound: "l'", coreWord: "amico" });
  });

  it("extracts article for word with apostrophe and space", () => {
    const result: ExtractedArticle = extractPrefix("l' amico", "amico", articles);
    expect(result).toEqual({ articleFound: "l'", coreWord: "amico" });
  });

  it("extracts article for word with standard article and space", () => {
    const result: ExtractedArticle = extractPrefix("il cane", "cane", articles);
    expect(result).toEqual({ articleFound: "il ", coreWord: "cane" });
  });

  it("returns null article if word does not start with any article", () => {
    const result: ExtractedArticle = extractPrefix("gatto", "gatto", articles);
    expect(result).toEqual({ articleFound: null, coreWord: "gatto" });
  });

  it("is case-insensitive", () => {
    const result: ExtractedArticle = extractPrefix("L'Amico", "amico", articles);
    expect(result).toEqual({ articleFound: "l'", coreWord: "L'Amico".slice(2) });
  });

  it("handles articles that do not match lemma", () => {
    const result: ExtractedArticle = extractPrefix("la casa", "cane", articles);
    expect(result).toEqual({ articleFound: null, coreWord: "la casa" });
  });

  it("does not modify core word if article is not present", () => {
    const result: ExtractedArticle = extractPrefix("casa", "casa", articles);
    expect(result).toEqual({ articleFound: null, coreWord: "casa" });
  });
});
