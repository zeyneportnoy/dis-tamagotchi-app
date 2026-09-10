import { render, waitFor } from '@testing-library/react-native';
import { Animated, StyleSheet, View } from 'react-native';

import { rewardCatalog } from '@/domain/rewards';
import { tr } from '@/i18n/resources/tr';

import {
  CharacterSceneEffect,
  DEFAULT_SCENE_EFFECT_KEY,
  EffectCardPreview,
  characterSceneEffectKeys,
  sceneEffectKeyForDisplay,
} from '../CharacterSceneEffect';

describe('sceneEffectKeyForDisplay — separates "no effect" from "invalid record"', () => {
  it('keeps a real, recognised scene-effect key as-is', () => {
    for (const key of characterSceneEffectKeys) {
      expect(sceneEffectKeyForDisplay(key)).toBe(key);
    }
  });

  it('returns null when nothing is equipped (null / undefined) — render no effect', () => {
    expect(sceneEffectKeyForDisplay(null)).toBeNull();
    expect(sceneEffectKeyForDisplay(undefined)).toBeNull();
  });

  it('falls back to the always-open default for the visual-less legacy bubble-glow seed', () => {
    // `bubble-glow` is a real (legacy) inventory row but has no visual and is
    // not in `rewardCatalog`; an existing record must still show something.
    expect(sceneEffectKeyForDisplay('bubble-glow' as never)).toBe('rainbow-light');
    expect(DEFAULT_SCENE_EFFECT_KEY).toBe('rainbow-light');
  });

  it('falls back to the default for any other unrecognised (but present) key', () => {
    expect(sceneEffectKeyForDisplay('heart-flight' as never)).toBe(DEFAULT_SCENE_EFFECT_KEY);
    expect(sceneEffectKeyForDisplay('star-brush' as never)).toBe(DEFAULT_SCENE_EFFECT_KEY);
  });
});

describe('CharacterSceneEffect', () => {
  it('exposes exactly the six product effects with their current Mine Puan thresholds', () => {
    expect(rewardCatalog.filter((item) => item.slot === 'effect')).toEqual([
      expect.objectContaining({ key: 'rainbow-light', unlockXp: 0 }),
      expect.objectContaining({ key: 'gold-sparkle', unlockXp: 80 }),
      expect.objectContaining({ key: 'star-sparkle', unlockXp: 240 }),
      expect.objectContaining({ key: 'confetti-glow', unlockXp: 600 }),
      expect.objectContaining({ key: 'magic-dust', unlockXp: 1200 }),
      expect.objectContaining({ key: 'cloud-effect', unlockXp: 2000 }),
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

  it('renders nothing at all when effectKey is null', async () => {
    const view = await render(
      <View style={{ height: 354, width: 320 }}>
        <CharacterSceneEffect animated={false} effectKey={null} testID="scene-effect" />
      </View>,
    );

    expect(view.queryByTestId('scene-effect')).toBeNull();
  });

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
