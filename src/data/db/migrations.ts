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
  {
    version: 6,
    name: 'add_parent_ownership_and_profile_sync_metadata',
    statements: [
      `ALTER TABLE child_profiles ADD COLUMN remote_id TEXT;`,
      `ALTER TABLE child_profiles ADD COLUMN parent_auth_user_id TEXT;`,
      `ALTER TABLE child_profiles ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'legacy_local'
        CHECK(sync_status IN ('legacy_local', 'pending', 'synced', 'failed'));`,
      `ALTER TABLE child_profiles ADD COLUMN updated_at TEXT;`,
      `UPDATE child_profiles SET updated_at = created_at WHERE updated_at IS NULL;`,
      `CREATE UNIQUE INDEX child_profiles_remote_id_uq
        ON child_profiles(remote_id) WHERE remote_id IS NOT NULL;`,
      `CREATE INDEX child_profiles_parent_auth_user_idx
        ON child_profiles(parent_auth_user_id);`,
    ],
  },
  {
    version: 7,
    name: 'isolate_active_profiles_by_parent',
    statements: [
      `CREATE TABLE active_parent_profile (
        parent_auth_user_id TEXT PRIMARY KEY NOT NULL,
        child_profile_id TEXT NOT NULL UNIQUE,
        FOREIGN KEY (child_profile_id) REFERENCES child_profiles(id) ON DELETE CASCADE
      );`,
      `INSERT OR IGNORE INTO active_parent_profile(parent_auth_user_id, child_profile_id)
       SELECT child_profiles.parent_auth_user_id, active_profile.child_profile_id
       FROM active_profile
       INNER JOIN child_profiles ON child_profiles.id = active_profile.child_profile_id
       WHERE active_profile.singleton = 1
         AND child_profiles.parent_auth_user_id IS NOT NULL;`,
    ],
  },
  {
    version: 8,
    name: 'add_rewards_daily_progress_and_inventory',
    statements: [
      `ALTER TABLE profile_progress ADD COLUMN total_xp INTEGER NOT NULL DEFAULT 0 CHECK(total_xp >= 0);`,
      `ALTER TABLE profile_progress ADD COLUMN level INTEGER NOT NULL DEFAULT 1 CHECK(level BETWEEN 1 AND 3);`,
      `ALTER TABLE profile_progress ADD COLUMN mood INTEGER NOT NULL DEFAULT 50 CHECK(mood BETWEEN 0 AND 100);`,
      `ALTER TABLE brushing_sessions ADD COLUMN reward_granted_at TEXT;`,
      `ALTER TABLE brushing_sessions ADD COLUMN xp_granted INTEGER NOT NULL DEFAULT 0 CHECK(xp_granted >= 0);`,
      `ALTER TABLE brushing_sessions ADD COLUMN mood_delta INTEGER NOT NULL DEFAULT 0;`,
      `ALTER TABLE brushing_sessions ADD COLUMN unlocked_item_key TEXT;`,
      `ALTER TABLE brushing_sessions ADD COLUMN local_day_key TEXT;`,
      `CREATE TABLE daily_progress (
        child_profile_id TEXT NOT NULL,
        local_day_key TEXT NOT NULL,
        morning_completed INTEGER NOT NULL DEFAULT 0 CHECK(morning_completed IN (0, 1)),
        evening_completed INTEGER NOT NULL DEFAULT 0 CHECK(evening_completed IN (0, 1)),
        full_day_completed INTEGER NOT NULL DEFAULT 0 CHECK(full_day_completed IN (0, 1)),
        streak_after_day INTEGER NOT NULL DEFAULT 0 CHECK(streak_after_day >= 0),
        PRIMARY KEY (child_profile_id, local_day_key),
        FOREIGN KEY (child_profile_id) REFERENCES child_profiles(id) ON DELETE CASCADE
      );`,
      `CREATE TABLE inventory_items (
        child_profile_id TEXT NOT NULL,
        item_key TEXT NOT NULL,
        unlocked_at TEXT NOT NULL,
        equipped INTEGER NOT NULL DEFAULT 0 CHECK(equipped IN (0, 1)),
        PRIMARY KEY (child_profile_id, item_key),
        FOREIGN KEY (child_profile_id) REFERENCES child_profiles(id) ON DELETE CASCADE
      );`,
      `CREATE UNIQUE INDEX inventory_one_equipped_per_profile_uq
        ON inventory_items(child_profile_id) WHERE equipped = 1;`,
      `INSERT OR IGNORE INTO inventory_items(child_profile_id, item_key, unlocked_at, equipped)
       SELECT id, 'cozy-scarf', COALESCE(updated_at, created_at), 1 FROM child_profiles;`,
      `INSERT OR IGNORE INTO daily_progress
        (child_profile_id, local_day_key, morning_completed, evening_completed,
         full_day_completed, streak_after_day)
       SELECT child_profile_id, status_date, morning_completed, evening_completed,
         CASE WHEN morning_completed = 1 AND evening_completed = 1 THEN 1 ELSE 0 END,
         current_streak
       FROM profile_progress;`,
    ],
  },
  {
    version: 9,
    name: 'seed_starter_inventory_for_existing_profiles',
    statements: [
      `INSERT OR IGNORE INTO inventory_items(child_profile_id, item_key, unlocked_at, equipped)
       SELECT id, 'cozy-scarf', COALESCE(updated_at, created_at), 1 FROM child_profiles;`,
    ],
  },
  {
    version: 10,
    name: 'persist_session_reward_result_snapshot',
    statements: [
      `ALTER TABLE brushing_sessions ADD COLUMN first_slot_completion INTEGER NOT NULL DEFAULT 0 CHECK(first_slot_completion IN (0, 1));`,
      `ALTER TABLE brushing_sessions ADD COLUMN streak_advanced INTEGER NOT NULL DEFAULT 0 CHECK(streak_advanced IN (0, 1));`,
      `ALTER TABLE brushing_sessions ADD COLUMN morning_completed_after INTEGER NOT NULL DEFAULT 0 CHECK(morning_completed_after IN (0, 1));`,
      `ALTER TABLE brushing_sessions ADD COLUMN evening_completed_after INTEGER NOT NULL DEFAULT 0 CHECK(evening_completed_after IN (0, 1));`,
      `ALTER TABLE brushing_sessions ADD COLUMN streak_after INTEGER NOT NULL DEFAULT 0 CHECK(streak_after >= 0);`,
    ],
  },
  {
    version: 11,
    name: 'rename_character_identity_keys',
    statements: [
      `UPDATE child_profiles SET avatar_id = CASE avatar_id
        WHEN 'cheerful-incisor' THEN 'inci'
        WHEN 'curious-tooth' THEN 'piril'
        WHEN 'brave-canine' THEN 'kaan'
        WHEN 'sunny-tooth' THEN 'milo'
        WHEN 'starry-tooth' THEN 'zipzip'
        WHEN 'shy-tooth' THEN 'topi'
        WHEN 'sleepy-molar' THEN 'akil'
        WHEN 'giggle-tooth' THEN 'uyku'
        ELSE avatar_id END;`,
    ],
  },
  {
    version: 12,
    name: 'add_inventory_accessory_slots',
    statements: [
      `ALTER TABLE inventory_items ADD COLUMN slot TEXT NOT NULL DEFAULT 'front'
        CHECK(slot IN ('head', 'face', 'front', 'effect'));`,
      `UPDATE inventory_items SET slot = CASE item_key
        WHEN 'sparkle-crown' THEN 'head'
        WHEN 'star-glasses' THEN 'face'
        WHEN 'rainbow-cape' THEN 'effect'
        ELSE 'front' END;`,
      `DROP INDEX inventory_one_equipped_per_profile_uq;`,
      `CREATE UNIQUE INDEX inventory_one_equipped_per_profile_slot_uq
        ON inventory_items(child_profile_id, slot) WHERE equipped = 1;`,
    ],
  },
  {
    version: 13,
    name: 'focus_inventory_on_room_rewards',
    statements: [
      `ALTER TABLE inventory_items RENAME TO inventory_items_accessory_legacy;`,
      `CREATE TABLE inventory_items (
        child_profile_id TEXT NOT NULL,
        item_key TEXT NOT NULL,
        unlocked_at TEXT NOT NULL,
        equipped INTEGER NOT NULL DEFAULT 0 CHECK(equipped IN (0, 1)),
        slot TEXT NOT NULL CHECK(slot IN ('wearable', 'background', 'decor', 'effect', 'brush')),
        PRIMARY KEY(child_profile_id, item_key),
        FOREIGN KEY(child_profile_id) REFERENCES child_profiles(id) ON DELETE CASCADE
      );`,
      `INSERT INTO inventory_items(child_profile_id, item_key, unlocked_at, equipped, slot)
       SELECT child_profile_id, item_key, unlocked_at, equipped, CASE item_key
         WHEN 'cozy-scarf' THEN 'decor'
         WHEN 'sparkle-crown' THEN 'wearable'
         WHEN 'star-crown' THEN 'wearable'
         WHEN 'mini-hat' THEN 'wearable'
         WHEN 'star-glasses' THEN 'wearable'
         WHEN 'super-glasses' THEN 'wearable'
         WHEN 'color-glasses' THEN 'wearable'
         WHEN 'heart-badge' THEN 'decor'
         WHEN 'star-badge' THEN 'decor'
         WHEN 'mini-cape' THEN 'brush'
         WHEN 'rainbow-cape' THEN 'background'
         ELSE 'effect' END
       FROM inventory_items_accessory_legacy;`,
      `DROP TABLE inventory_items_accessory_legacy;`,
      `CREATE UNIQUE INDEX inventory_one_equipped_per_profile_slot_uq
        ON inventory_items(child_profile_id, slot) WHERE equipped = 1;`,
    ],
  },
  {
    version: 14,
    name: 'add_starter_room_personalization_rewards',
    statements: [
      `INSERT OR IGNORE INTO inventory_items(child_profile_id, item_key, unlocked_at, equipped, slot)
       SELECT id, 'pastel-playroom', COALESCE(updated_at, created_at),
         CASE WHEN EXISTS (SELECT 1 FROM inventory_items i WHERE i.child_profile_id = child_profiles.id AND i.slot = 'background' AND i.equipped = 1) THEN 0 ELSE 1 END,
         'background'
       FROM child_profiles WHERE archived_at IS NULL;`,
      `INSERT OR IGNORE INTO inventory_items(child_profile_id, item_key, unlocked_at, equipped, slot)
       SELECT id, 'bubble-glow', COALESCE(updated_at, created_at),
         CASE WHEN EXISTS (SELECT 1 FROM inventory_items i WHERE i.child_profile_id = child_profiles.id AND i.slot = 'effect' AND i.equipped = 1) THEN 0 ELSE 1 END,
         'effect'
       FROM child_profiles WHERE archived_at IS NULL;`,
      `INSERT OR IGNORE INTO inventory_items(child_profile_id, item_key, unlocked_at, equipped, slot)
       SELECT id, 'classic-brush', COALESCE(updated_at, created_at),
         CASE WHEN EXISTS (SELECT 1 FROM inventory_items i WHERE i.child_profile_id = child_profiles.id AND i.slot = 'brush' AND i.equipped = 1) THEN 0 ELSE 1 END,
         'brush'
       FROM child_profiles WHERE archived_at IS NULL;`,
    ],
  },
  {
    version: 15,
    name: 'add_child_dentist_reminders',
    statements: [
      `CREATE TABLE dentist_reminders (
        child_profile_id TEXT PRIMARY KEY NOT NULL,
        first_due_at TEXT NOT NULL,
        second_due_at TEXT NOT NULL,
        first_notification_id TEXT,
        second_notification_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (child_profile_id) REFERENCES child_profiles(id) ON DELETE CASCADE
      );`,
      `CREATE INDEX dentist_reminders_first_due_idx ON dentist_reminders(first_due_at);`,
    ],
  },
  {
    version: 16,
    name: 'add_child_date_of_birth',
    statements: [
      `ALTER TABLE child_profiles ADD COLUMN date_of_birth TEXT
        CHECK(date_of_birth IS NULL OR
          (date(date_of_birth) IS NOT NULL AND date_of_birth = date(date_of_birth)));`,
      `CREATE INDEX child_profiles_date_of_birth_idx ON child_profiles(date_of_birth);`,
    ],
  },
  {
    version: 17,
    name: 'add_main_slot_reconciliation',
    statements: [
      `ALTER TABLE brushing_sessions RENAME TO brushing_sessions_period_legacy;`,
      `CREATE TABLE brushing_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        profile_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL CHECK(duration_seconds >= 0),
        completed INTEGER NOT NULL CHECK(completed IN (0, 1)),
        period TEXT CHECK(period IN ('morning', 'evening')),
        created_at TEXT NOT NULL,
        reward_granted_at TEXT,
        xp_granted INTEGER NOT NULL DEFAULT 0 CHECK(xp_granted >= 0),
        mood_delta INTEGER NOT NULL DEFAULT 0,
        unlocked_item_key TEXT,
        local_day_key TEXT,
        first_slot_completion INTEGER NOT NULL DEFAULT 0 CHECK(first_slot_completion IN (0, 1)),
        streak_advanced INTEGER NOT NULL DEFAULT 0 CHECK(streak_advanced IN (0, 1)),
        morning_completed_after INTEGER NOT NULL DEFAULT 0 CHECK(morning_completed_after IN (0, 1)),
        evening_completed_after INTEGER NOT NULL DEFAULT 0 CHECK(evening_completed_after IN (0, 1)),
        streak_after INTEGER NOT NULL DEFAULT 0 CHECK(streak_after >= 0),
        FOREIGN KEY (profile_id) REFERENCES child_profiles(id) ON DELETE CASCADE
      );`,
      `INSERT INTO brushing_sessions
        (id, profile_id, started_at, completed_at, duration_seconds, completed, period, created_at,
         reward_granted_at, xp_granted, mood_delta, unlocked_item_key, local_day_key,
         first_slot_completion, streak_advanced, morning_completed_after,
         evening_completed_after, streak_after)
       SELECT id, profile_id, started_at, completed_at, duration_seconds, completed, period,
         created_at, reward_granted_at, xp_granted, mood_delta, unlocked_item_key, local_day_key,
         first_slot_completion, streak_advanced, morning_completed_after,
         evening_completed_after, streak_after
       FROM brushing_sessions_period_legacy;`,
      `DROP TABLE brushing_sessions_period_legacy;`,
      `CREATE INDEX brushing_sessions_profile_completed_idx
        ON brushing_sessions(profile_id, completed_at);`,
      `CREATE TABLE brushing_session_attempts (
        session_id TEXT PRIMARY KEY NOT NULL,
        profile_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        local_day_key TEXT NOT NULL,
        period TEXT CHECK(period IN ('morning', 'evening')),
        resolved_at TEXT,
        completed INTEGER CHECK(completed IN (0, 1)),
        FOREIGN KEY (profile_id) REFERENCES child_profiles(id) ON DELETE CASCADE
      );`,
      `CREATE INDEX brushing_session_attempts_open_slot_idx
        ON brushing_session_attempts(profile_id, local_day_key, period)
        WHERE resolved_at IS NULL;`,
      `CREATE TABLE brushing_slot_evaluations (
        child_profile_id TEXT NOT NULL,
        local_day_key TEXT NOT NULL,
        period TEXT NOT NULL CHECK(period IN ('morning', 'evening')),
        outcome TEXT NOT NULL CHECK(outcome IN ('completed', 'missed')),
        penalty_amount INTEGER NOT NULL CHECK(penalty_amount IN (-10, 0)),
        score_before INTEGER NOT NULL CHECK(score_before >= 0),
        score_after INTEGER NOT NULL CHECK(score_after >= 0),
        evaluated_at TEXT NOT NULL,
        PRIMARY KEY(child_profile_id, local_day_key, period),
        FOREIGN KEY (child_profile_id) REFERENCES child_profiles(id) ON DELETE CASCADE
      );`,
      `CREATE INDEX brushing_slot_evaluations_profile_idx
        ON brushing_slot_evaluations(child_profile_id, evaluated_at);`,
    ],
  },
];
