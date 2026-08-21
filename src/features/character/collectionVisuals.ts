import type { StarterAvatarKey } from '@/domain/family';
import type { CharacterGrowthStage } from '@/domain/rewards';

export type CollectionVisualPalette = Readonly<{
  accent: string;
  card: string;
  hero: string;
  selectedCard: string;
  soft: string;
}>;

export const collectionVisualPalette: Record<StarterAvatarKey, CollectionVisualPalette> = {
  inci: {
    accent: '#5E8FE8',
    card: 'rgba(240,248,255,0.82)',
    hero: '#B9DEFF',
    selectedCard: '#E4F2FF',
    soft: '#EDF7FF',
  },
  piril: {
    accent: '#DF6FA8',
    card: 'rgba(255,242,248,0.84)',
    hero: '#F7C7E0',
    selectedCard: '#FFE4F1',
    soft: '#FFF0F7',
  },
  kaan: {
    accent: '#4C9B68',
    card: 'rgba(242,255,244,0.84)',
    hero: '#BFE8CB',
    selectedCard: '#DDF4E3',
    soft: '#EEFAF1',
  },
  milo: {
    accent: '#8B62C7',
    card: 'rgba(250,244,255,0.84)',
    hero: '#D8C2F5',
    selectedCard: '#EEDFFF',
    soft: '#F7F0FF',
  },
  zipzip: {
    accent: '#319DA9',
    card: 'rgba(240,255,255,0.84)',
    hero: '#AEE7E8',
    selectedCard: '#D9F6F5',
    soft: '#EDFCFC',
  },
  topi: {
    accent: '#C99720',
    card: 'rgba(255,251,235,0.86)',
    hero: '#FFE6A1',
    selectedCard: '#FFF2C9',
    soft: '#FFF9E6',
  },
  akil: {
    accent: '#D77A32',
    card: 'rgba(255,247,237,0.86)',
    hero: '#FFD0A3',
    selectedCard: '#FFE6CE',
    soft: '#FFF4E8',
  },
  uyku: {
    accent: '#5368A8',
    card: 'rgba(239,243,255,0.86)',
    hero: '#A9B9E8',
    selectedCard: '#DCE4FF',
    soft: '#EDF1FF',
  },
};

export function collectionPreviewBottomForStage(stage: CharacterGrowthStage): number {
  if (stage <= 1) return 22;
  if (stage === 2) return 26;
  if (stage === 3) return 28;
  return 30;
}
