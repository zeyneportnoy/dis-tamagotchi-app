import { starterAvatarKeys } from '@/domain/family';
import { characterMoodKeys } from '@/domain/character';

import { moodSources, type MoodLifecycleKey } from '../assets/moodSources';

const stages: readonly MoodLifecycleKey[] = ['egg', 'cracking', 'baby', 'growing', 'developed'];

describe('character mood assets', () => {
  it('provides every mood for every character and lifecycle stage', () => {
    for (const character of starterAvatarKeys) {
      for (const stage of stages) {
        for (const mood of characterMoodKeys) {
          expect(moodSources[character][stage][mood]).toBeDefined();
        }
      }
    }
  });
});
