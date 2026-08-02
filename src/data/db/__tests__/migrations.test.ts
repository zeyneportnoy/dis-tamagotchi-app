import { migrations } from '../migrations';

describe('M0 migrations', () => {
  it('does not create product tables', () => {
    expect(migrations).toEqual([]);
  });
});
