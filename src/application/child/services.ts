import { getDatabase } from '@/data/db';
import {
  SQLiteBrushingSessionRepository,
  SQLiteInventoryRepository,
  SQLiteProfileProgressRepository,
} from '@/data/repositories';
import { getParentAuthUseCases } from '@/application/auth';

import { ChildExperienceUseCases } from './useCases';

let useCasesPromise: Promise<ChildExperienceUseCases> | undefined;

export function getChildExperienceUseCases(): Promise<ChildExperienceUseCases> {
  useCasesPromise ??= getDatabase().then((database) => {
    const getActiveParentId = async (): Promise<string | null> =>
      (await getParentAuthUseCases()?.getSession())?.userId ?? null;
    return new ChildExperienceUseCases(
      new SQLiteProfileProgressRepository(database),
      new SQLiteBrushingSessionRepository(database, undefined, undefined, getActiveParentId),
      new SQLiteInventoryRepository(database, getActiveParentId),
    );
  });
  return useCasesPromise;
}
