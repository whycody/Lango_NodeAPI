export enum SessionMode {
  Heuristic = 'heuristic',
  ML = 'ml',
  Hybrid = 'hybrid',
}

export type SessionModeValue = `${SessionMode}`