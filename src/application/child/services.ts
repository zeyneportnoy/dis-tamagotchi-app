import { getDatabase } from '@/data/db';
import {
  SQLiteBrushingSessionRepository,
  SQLiteProfileProgressRepository,
} from '@/data/repositories';

import { ChildExperienceUseCases } from './useCases';

let useCasesPromise: Promise<ChildExperienceUseCases> | undefined;

export function getChildExperienceUseCases(): Promise<ChildExperienceUseCases> {
  useCasesPromise ??= getDatabase().then(
    (database) =>
      new ChildExperienceUseCases(
        new SQLiteProfileProgressRepository(database),
        new SQLiteBrushingSessionRepository(database),
      ),
  );
  return useCasesPromise;
}
