export type Migration = Readonly<{ version: number; name: string; statements: readonly string[] }>;

export const migrations: readonly Migration[] = [
  {
    version: 1,
    name: 'create_family_and_profiles',
    statements: [
      `CREATE TABLE families (
        id TEXT PRIMARY KEY NOT NULL,
        created_at TEXT NOT NULL,
        locale TEXT NOT NULL,
        timezone TEXT NOT NULL,
        cloud_account_id TEXT UNIQUE
      );`,
      `CREATE TABLE child_profiles (
        id TEXT PRIMARY KEY NOT NULL,
        family_id TEXT NOT NULL,
        nickname TEXT NOT NULL CHECK(length(trim(nickname)) BETWEEN 1 AND 20),
        age_band TEXT NOT NULL CHECK(age_band IN ('6_8', '9_10')),
        avatar_id TEXT NOT NULL CHECK(length(trim(avatar_id)) > 0),
        created_at TEXT NOT NULL,
        archived_at TEXT,
        FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
      );`,
      `CREATE UNIQUE INDEX child_profiles_family_nickname_uq
        ON child_profiles(family_id, nickname COLLATE NOCASE);`,
      `CREATE INDEX child_profiles_family_idx ON child_profiles(family_id);`,
      `CREATE TABLE active_profile (
        singleton INTEGER PRIMARY KEY NOT NULL CHECK(singleton = 1),
        child_profile_id TEXT,
        FOREIGN KEY (child_profile_id) REFERENCES child_profiles(id) ON DELETE SET NULL
      );`,
      `INSERT INTO active_profile(singleton, child_profile_id) VALUES (1, NULL);`,
    ],
  },
  {
    version: 2,
    name: 'allow_duplicate_profile_nicknames',
    statements: ['DROP INDEX IF EXISTS child_profiles_family_nickname_uq;'],
  },
];
