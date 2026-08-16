import { brushingVoiceCues, getBrushingVoiceCue, shouldPlayVoiceCue } from '../voiceGuidance';

const expectedOrder = [
  { boundarySecond: 0, region: 'rightUpper' },
  { boundarySecond: 30, region: 'leftUpper' },
  { boundarySecond: 60, region: 'rightLower' },
  { boundarySecond: 90, region: 'leftLower' },
];

describe('bundled brushing voice profiles', () => {
  it.each(['gokce', 'samet'] as const)(
    '%s maps four distinct local recordings in order',
    (profile) => {
      const cues = brushingVoiceCues[profile];
      expect(cues.map(({ boundarySecond, region }) => ({ boundarySecond, region }))).toEqual(
        expectedOrder,
      );
      expect(new Set(cues.map(({ path }) => path)).size).toBe(4);
    },
  );

  it('selects the active profile asset and returns no asset when off', () => {
    expect(getBrushingVoiceCue('gokce', 0)?.path).toContain('right-upper.mp3');
    expect(getBrushingVoiceCue('samet', 0)?.path).toContain('samet/right-upper.m4a');
    expect(getBrushingVoiceCue('off', 0)).toBeNull();
  });

  it('plays once per segment and never at completion or while off', () => {
    expect(
      shouldPlayVoiceCue({
        completed: false,
        lastAnnouncedSegment: -1,
        profile: 'samet',
        segmentIndex: 0,
      }),
    ).toBe(true);
    expect(
      shouldPlayVoiceCue({
        completed: false,
        lastAnnouncedSegment: 0,
        profile: 'samet',
        segmentIndex: 0,
      }),
    ).toBe(false);
    expect(
      shouldPlayVoiceCue({
        completed: false,
        lastAnnouncedSegment: -1,
        profile: 'off',
        segmentIndex: 0,
      }),
    ).toBe(false);
    expect(
      shouldPlayVoiceCue({
        completed: true,
        lastAnnouncedSegment: 3,
        profile: 'gokce',
        segmentIndex: 3,
      }),
    ).toBe(false);
  });
});
