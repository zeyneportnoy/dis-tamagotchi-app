import { render } from '@testing-library/react-native';

import { SceneCustomizationItem } from '../SceneCustomizationItem';

describe('SceneCustomizationItem', () => {
  it('exposes drag and removal controls only while editing', async () => {
    const view = await render(
      <SceneCustomizationItem
        accessibilityLabel="Bulut Minder"
        editable
        itemKey="cozy-scarf"
        kind="decor"
        onPlacementChange={jest.fn()}
        onRemove={jest.fn()}
        placement={{ scale: 1, x: 0.5, y: 0.5 }}
        removeLabel="Bulut Minder öğesini kaldır"
        sceneSize={{ height: 400, width: 500 }}
        zIndex={2}
      />,
    );
    expect(view.getByTestId('scene-item-cozy-scarf').props.pointerEvents).toBe('auto');
    expect(view.getByTestId('remove-scene-item-cozy-scarf')).toBeTruthy();
  });

  it('does not capture touches outside edit mode', async () => {
    const view = await render(
      <SceneCustomizationItem
        accessibilityLabel="Mini Taç"
        editable={false}
        itemKey="sparkle-crown"
        kind="wearable"
        onPlacementChange={jest.fn()}
        placement={{ scale: 1, x: 0.5, y: 0.2 }}
        removeLabel="Mini Taç öğesini kaldır"
        sceneSize={{ height: 400, width: 500 }}
        zIndex={4}
      />,
    );

    expect(view.getByTestId('scene-item-sparkle-crown').props.pointerEvents).toBe('none');
    expect(view.queryByTestId('remove-scene-item-sparkle-crown')).toBeNull();
  });
});
