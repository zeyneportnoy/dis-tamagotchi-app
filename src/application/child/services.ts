import { getDatabase } from '@/data/db';
import { SQLiteProfileProgressRepository } from '@/data/repositories';

import { ChildExperienceUseCases } from './useCases';

let useCasesPromise: Promise<ChildExperienceUseCases> | undefined;

export function getChildExperienceUseCases(): Promise<ChildExperienceUseCases> {
  useCasesPromise ??= getDatabase().then(
    (database) => new ChildExperienceUseCases(new SQLiteProfileProgressRepository(database)),
  );
  return useCasesPromise;
}
