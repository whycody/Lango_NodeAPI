import { endGeneration, isGenerationInProgress, startGeneration } from "../generationLock";

export async function withGenerationLock(key: string, fn: () => Promise<void>) {
  if (isGenerationInProgress(key)) return;
  startGeneration(key);
  try {
    await fn();
  } finally {
    endGeneration(key);
  }
}
