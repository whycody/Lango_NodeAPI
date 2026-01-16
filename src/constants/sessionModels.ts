export enum SessionModel {
  Heuristic = 'heuristic',
  ML = 'ml',
  Hybrid = 'hybrid',
}

export type SessionModelValue = `${SessionModel}`