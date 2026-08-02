jest.mock('expo-sqlite', () => ({}));

// The mock must be registered before the module under test is evaluated.
// eslint-disable-next-line import/first
import { checkDatabaseHealth } from '../database';

describe('database health check', () => {
  it('returns true when SQLite responds', async () => {
    const database = { getFirstAsync: jest.fn().mockResolvedValue({ ok: 1 }) };
    await expect(checkDatabaseHealth(database as never)).resolves.toBe(true);
  });
});
