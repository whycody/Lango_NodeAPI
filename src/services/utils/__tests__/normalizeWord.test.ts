import { normalizeWord } from "../normalizeWord";

describe("normalizeWord", () => {
  it("does not change word without apostrophe", () => {
    expect(normalizeWord("amico")).toBe("amico");
  });

  it("does not change word with correct apostrophe", () => {
    expect(normalizeWord("l'amico")).toBe("l'amico");
  });

  it("removes single space after apostrophe", () => {
    expect(normalizeWord("l' amico")).toBe("l'amico");
  });

  it("removes multiple spaces after apostrophe", () => {
    expect(normalizeWord("l'   amico")).toBe("l'amico");
  });

  it("works with apostrophe at different positions", () => {
    expect(normalizeWord("d' uomo")).toBe("d'uomo");
  });

  it("does not affect other spaces", () => {
    expect(normalizeWord("il cane")).toBe("il cane");
  });
});