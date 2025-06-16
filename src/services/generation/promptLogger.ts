import { PromptReport } from "../../models/PromptReport";

interface PromptReportData {
  prompt: string;
  words: string[];
  excludedWords: string[];
  totalWords: number;
  hasExcludedWords: boolean;
  addedWords: string[];
  tokensInput?: number;
  tokensOutput?: number;
  costUSD?: number;
  model: string;
  success: boolean;
  firstLang?: string;
  secondLang?: string;
  userId?: string;
}

export async function logPromptReport(data: PromptReportData) {
  try {
    return await PromptReport.create(data);
  } catch (error) {
    console.error('Error logging prompt report:', error);
    throw error;
  }
}