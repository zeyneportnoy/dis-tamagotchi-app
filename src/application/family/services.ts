import { getDatabase } from '@/data/db';
import { SQLiteChildProfileRepository, SQLiteFamilyRepository } from '@/data/repositories';

import { FamilyUseCases } from './useCases';

let useCasesPromise: Promise<FamilyUseCases> | undefined;

export function getFamilyUseCases(): Promise<FamilyUseCases> {
  useCasesPromise ??= getDatabase().then(
    (database) =>
      new FamilyUseCases(
        new SQLiteFamilyRepository(database),
        new SQLiteChildProfileRepository(database),
      ),
  );
  return useCasesPromise;
}
