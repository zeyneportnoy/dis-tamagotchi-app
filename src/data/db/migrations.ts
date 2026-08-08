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
  {
    version: 3,
    name: 'support_target_age_bands_4_11',
    statements: [
      `CREATE TABLE active_profile_backup AS
        SELECT singleton, child_profile_id FROM active_profile;`,
      `DROP TABLE active_profile;`,
      `CREATE TABLE child_profiles_next (
        id TEXT PRIMARY KEY NOT NULL,
        family_id TEXT NOT NULL,
        nickname TEXT NOT NULL CHECK(length(trim(nickname)) BETWEEN 1 AND 20),
        age_band TEXT NOT NULL CHECK(age_band IN ('4_6', '7_11', '6_8', '9_10')),
        avatar_id TEXT NOT NULL CHECK(length(trim(avatar_id)) > 0),
        created_at TEXT NOT NULL,
        archived_at TEXT,
        FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
      );`,
      `INSERT INTO child_profiles_next
        (id, family_id, nickname, age_band, avatar_id, created_at, archived_at)
       SELECT id, family_id, nickname, age_band, avatar_id, created_at, archived_at
       FROM child_profiles;`,
      `DROP TABLE child_profiles;`,
      `ALTER TABLE child_profiles_next RENAME TO child_profiles;`,
      `CREATE INDEX child_profiles_family_idx ON child_profiles(family_id);`,
      `CREATE TABLE active_profile (
        singleton INTEGER PRIMARY KEY NOT NULL CHECK(singleton = 1),
        child_profile_id TEXT,
        FOREIGN KEY (child_profile_id) REFERENCES child_profiles(id) ON DELETE SET NULL
      );`,
      `INSERT INTO active_profile(singleton, child_profile_id)
       SELECT singleton, child_profile_id FROM active_profile_backup;`,
      `DROP TABLE active_profile_backup;`,
    ],
  },
  {
    version: 4,
    name: 'add_profile_brushing_progress',
    statements: [
      `CREATE TABLE profile_progress (
        child_profile_id TEXT PRIMARY KEY NOT NULL,
        status_date TEXT NOT NULL,
        morning_completed INTEGER NOT NULL DEFAULT 0 CHECK(morning_completed IN (0, 1)),
        evening_completed INTEGER NOT NULL DEFAULT 0 CHECK(evening_completed IN (0, 1)),
        current_streak INTEGER NOT NULL DEFAULT 0 CHECK(current_streak >= 0),
        last_interaction_at TEXT,
        last_brushing_at TEXT,
        FOREIGN KEY (child_profile_id) REFERENCES child_profiles(id) ON DELETE CASCADE
      );`,
    ],
  },
  {
    version: 5,
    name: 'add_brushing_session_history',
    statements: [
      `CREATE TABLE brushing_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        profile_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL CHECK(duration_seconds >= 0),
        completed INTEGER NOT NULL CHECK(completed IN (0, 1)),
        period TEXT NOT NULL CHECK(period IN ('morning', 'evening')),
        created_at TEXT NOT NULL,
        FOREIGN KEY (profile_id) REFERENCES child_profiles(id) ON DELETE CASCADE
      );`,
      `CREATE INDEX brushing_sessions_profile_completed_idx
        ON brushing_sessions(profile_id, completed_at);`,
    ],
  },
];
