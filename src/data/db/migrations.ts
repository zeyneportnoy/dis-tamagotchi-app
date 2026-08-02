export type Migration = Readonly<{ version: number; name: string; statements: readonly string[] }>;

// M0 intentionally contains no product schema. M1 starts at migration 1.
export const migrations: readonly Migration[] = [];
