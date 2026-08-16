export const brushingVoiceProfiles = ['gokce', 'samet', 'off'] as const;

export type BrushingVoiceProfile = (typeof brushingVoiceProfiles)[number];

const gokceVoiceCues = [
  {
    boundarySecond: 0,
    path: 'assets/audio/brushing-voice/right-upper.mp3',
    region: 'rightUpper',
    source: require('../../../assets/audio/brushing-voice/right-upper.mp3'),
  },
  {
    boundarySecond: 30,
    path: 'assets/audio/brushing-voice/left-upper.mp3',
    region: 'leftUpper',
    source: require('../../../assets/audio/brushing-voice/left-upper.mp3'),
  },
  {
    boundarySecond: 60,
    path: 'assets/audio/brushing-voice/right-lower.mp3',
    region: 'rightLower',
    source: require('../../../assets/audio/brushing-voice/right-lower.mp3'),
  },
  {
    boundarySecond: 90,
    path: 'assets/audio/brushing-voice/left-lower.mp3',
    region: 'leftLower',
    source: require('../../../assets/audio/brushing-voice/left-lower.mp3'),
  },
] as const;

const sametVoiceCues = [
  {
    boundarySecond: 0,
    path: 'assets/audio/brushing-voice/samet/right-upper.m4a',
    region: 'rightUpper',
    source: require('../../../assets/audio/brushing-voice/samet/right-upper.m4a'),
  },
  {
    boundarySecond: 30,
    path: 'assets/audio/brushing-voice/samet/left-upper.m4a',
    region: 'leftUpper',
    source: require('../../../assets/audio/brushing-voice/samet/left-upper.m4a'),
  },
  {
    boundarySecond: 60,
    path: 'assets/audio/brushing-voice/samet/right-lower.m4a',
    region: 'rightLower',
    source: require('../../../assets/audio/brushing-voice/samet/right-lower.m4a'),
  },
  {
    boundarySecond: 90,
    path: 'assets/audio/brushing-voice/samet/left-lower.m4a',
    region: 'leftLower',
    source: require('../../../assets/audio/brushing-voice/samet/left-lower.m4a'),
  },
] as const;

export const brushingVoiceCues = { gokce: gokceVoiceCues, samet: sametVoiceCues } as const;

export function getBrushingVoiceCue(profile: BrushingVoiceProfile, segmentIndex: number) {
  if (profile === 'off') return null;
  return brushingVoiceCues[profile][segmentIndex] ?? null;
}

export function shouldPlayVoiceCue(input: {
  completed: boolean;
  lastAnnouncedSegment: number;
  profile: BrushingVoiceProfile;
  segmentIndex: number;
}): boolean {
  return (
    input.profile !== 'off' &&
    !input.completed &&
    input.segmentIndex >= 0 &&
    input.segmentIndex < gokceVoiceCues.length &&
    input.lastAnnouncedSegment !== input.segmentIndex
  );
}
