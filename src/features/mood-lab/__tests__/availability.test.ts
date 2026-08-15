import { isMoodLabAvailable } from '../availability';

describe('Mood Lab availability', () => {
  it('is available only in development builds', () => {
    expect(isMoodLabAvailable(true)).toBe(true);
    expect(isMoodLabAvailable(false)).toBe(false);
  });
});
