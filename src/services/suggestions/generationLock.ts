const generationInProgress = new Set<string>();

export function isGenerationInProgress(key: string) {
  return generationInProgress.has(key);
}

export function startGeneration(key: string) {
  generationInProgress.add(key);
}

export function endGeneration(key: string) {
  generationInProgress.delete(key);
}