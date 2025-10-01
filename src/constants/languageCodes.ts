export enum LanguageCode {
  Pl = "pl",
  It = "it",
  En = "en",
  Es = "es",
}

export function isLanguageCodeValue(value: any): value is LanguageCodeValue {
  return Object.values(LanguageCode).includes(value);
}

export type LanguageCodeValue = `${LanguageCode}`