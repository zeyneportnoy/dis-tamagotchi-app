import type { StarterAvatarKey } from '@/domain/family';
import type { CharacterGrowthStage } from '@/domain/rewards';

export type BrushPoint = { x: number; y: number };
type VisibleBody = { bottom: number; left: number; right: number; top: number };

const characterBodies: Record<StarterAvatarKey, VisibleBody> = {
  inci: { bottom: 150, left: 70, right: 176, top: 35 },
  piril: { bottom: 151, left: 67, right: 177, top: 34 },
  kaan: { bottom: 151, left: 72, right: 174, top: 31 },
  milo: { bottom: 150, left: 68, right: 178, top: 33 },
  zipzip: { bottom: 151, left: 64, right: 181, top: 38 },
  topi: { bottom: 151, left: 66, right: 179, top: 36 },
  akil: { bottom: 150, left: 63, right: 182, top: 35 },
  uyku: { bottom: 148, left: 62, right: 183, top: 46 },
};

const stageInsets: Record<CharacterGrowthStage, { x: number; y: number }> = {
  0: { x: 17, y: 8 },
  1: { x: 13, y: 6 },
  2: { x: 12, y: 7 },
  3: { x: 5, y: 3 },
  4: { x: 0, y: 0 },
};

const patterns = [
  [
    [0.18, 0.24],
    [0.52, 0.18],
    [0.78, 0.36],
    [0.58, 0.58],
    [0.22, 0.52],
    [0.38, 0.78],
  ],
  [
    [0.72, 0.2],
    [0.34, 0.3],
    [0.2, 0.62],
    [0.55, 0.76],
    [0.82, 0.57],
    [0.48, 0.46],
  ],
  [
    [0.25, 0.72],
    [0.18, 0.38],
    [0.46, 0.2],
    [0.78, 0.3],
    [0.7, 0.68],
    [0.42, 0.58],
  ],
] as const;

export function brushPathFor(
  characterKey: StarterAvatarKey,
  stage: CharacterGrowthStage,
  variant: number,
): BrushPoint[] {
  const body = characterBodies[characterKey];
  const inset = stageInsets[stage];
  const left = body.left + inset.x;
  const right = body.right - inset.x;
  const top = body.top + inset.y;
  const bottom = body.bottom - inset.y;
  const pattern = patterns[Math.abs(variant) % patterns.length] ?? patterns[0];
  return pattern.map(([xRatio, yRatio]) => ({
    x: Math.round(left + (right - left) * xRatio),
    y: Math.round(top + (bottom - top) * yRatio),
  }));
}

export const brushMotionCharacterKeys = Object.keys(characterBodies) as StarterAvatarKey[];
