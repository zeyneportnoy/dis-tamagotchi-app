import { render, waitFor } from '@testing-library/react-native';
import { Animated, StyleSheet, View } from 'react-native';

import { rewardCatalog } from '@/domain/rewards';
import { tr } from '@/i18n/resources/tr';

import {
  CharacterSceneEffect,
  EffectCardPreview,
  characterSceneEffectKeys,
} from '../CharacterSceneEffect';

describe('CharacterSceneEffect', () => {
  it('exposes exactly the six product effects with the existing unlock thresholds', () => {
    expect(rewardCatalog.filter((item) => item.slot === 'effect')).toEqual([
      expect.objectContaining({ key: 'rainbow-light', unlockXp: 300 }),
      expect.objectContaining({ key: 'gold-sparkle', unlockXp: 480 }),
      expect.objectContaining({ key: 'star-sparkle', unlockXp: 600 }),
      expect.objectContaining({ key: 'confetti-glow', unlockXp: 720 }),
      expect.objectContaining({ key: 'magic-dust', unlockXp: 920 }),
      expect.objectContaining({ key: 'cloud-effect', unlockXp: 1080 }),
    ]);
    expect(rewardCatalog).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ key: 'bubble-glow' }),
        expect.objectContaining({ key: 'heart-flight' }),
      ]),
    );
  });

  it('uses the approved Turkish display names', () => {
    expect(characterSceneEffectKeys.map((key) => tr.translation.rewards.items[key])).toEqual([
      'Gökkuşağı Parıltısı',
      'Yıldız Tozu',
      'Minik Işıklar',
      'Kutlama',
      'Sihirli Işık',
      'Gece Tozu',
    ]);
  });

  it.each(characterSceneEffectKeys)(
    'renders %s inside a clipped local layer',
    async (effectKey) => {
      const view = await render(
        <View style={{ height: 354, width: 320 }}>
          <CharacterSceneEffect animated={false} effectKey={effectKey} testID="scene-effect" />
        </View>,
      );

      expect(StyleSheet.flatten(view.getByTestId('scene-effect').props.style)).toMatchObject({
        bottom: 0,
        left: 0,
        overflow: 'hidden',
        position: 'absolute',
        right: 0,
        top: 0,
      });
    },
  );

  it('renders a dedicated card preview for every scene effect', async () => {
    const view = await render(
      <View>
        {characterSceneEffectKeys.map((effectKey) => (
          <EffectCardPreview effectKey={effectKey} key={effectKey} />
        ))}
      </View>,
    );

    for (const effectKey of characterSceneEffectKeys) {
      expect(view.getByTestId(`collection-effect-card-preview-${effectKey}`)).toBeTruthy();
    }
  });

  it('runs Kutlama through the same continuous loop as the other selected effects', async () => {
    const start = jest.fn();
    const stop = jest.fn();
    const loop = jest
      .spyOn(Animated, 'loop')
      .mockReturnValue({ reset: jest.fn(), start, stop } as ReturnType<typeof Animated.loop>);

    const view = await render(<CharacterSceneEffect effectKey="confetti-glow" />);
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    await view.unmount();
    expect(stop).toHaveBeenCalledTimes(1);
    loop.mockRestore();
  });
});
