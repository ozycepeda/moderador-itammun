export type D1RunResult = {
  success?: boolean;
  meta?: Record<string, unknown>;
};

export type D1AllResult<T> = D1RunResult & {
  results?: T[];
};

export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1AllResult<T>>;
  run(): Promise<D1RunResult>;
}

export interface AttendanceDatabase {
  prepare(query: string): D1Statement;
  batch(statements: D1Statement[]): Promise<D1RunResult[]>;
}
