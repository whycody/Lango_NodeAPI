export enum SessionMode {
  Study = "STUDY",
  Oldest = "OLDEST",
  Random = "RANDOM",
  Unknown = "UNKNOWN"
}

export type SessionModeValue = `${SessionMode}`