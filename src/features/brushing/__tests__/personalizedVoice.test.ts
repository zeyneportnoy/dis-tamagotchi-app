import {
  createPersonalizedVoiceIdentity,
  normalizeVoiceNickname,
  personalizedVoiceCueIndexes,
  personalizedVoiceModelVersion,
} from '../personalizedVoice';

describe('personalized brushing voice identity', () => {
  it('normalizes Turkish nicknames and only personalizes the measured 0/60 cues', () => {
    expect(normalizeVoiceNickname('  EMRAH  ')).toBe('emrah');
    expect(personalizedVoiceCueIndexes).toEqual([0, 2]);
  });

  it('separates cache identity by child, nickname, voice, cue and model version', () => {
    const identity = createPersonalizedVoiceIdentity({
      childProfileId: 'child-a',
      cueIndex: 2,
      nickname: ' İnci ',
      profile: 'gokce',
    });
    expect(identity).toEqual({
      childProfileId: 'child-a',
      cueIndex: 2,
      modelVersion: personalizedVoiceModelVersion,
      normalizedNickname: 'inci',
      profile: 'gokce',
    });
    expect(
      createPersonalizedVoiceIdentity({ ...identity, childProfileId: 'child-b', nickname: 'inci' }),
    ).not.toEqual(identity);
    expect(createPersonalizedVoiceIdentity({ ...identity, nickname: 'Ege' })).not.toEqual(identity);
  });
});
