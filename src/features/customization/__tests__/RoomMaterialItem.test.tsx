import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { RoomMaterialItem } from '../RoomMaterialItem';

describe('RoomMaterialItem', () => {
  it('renders as a cardless draggable scene object', async () => {
    const view = await render(
      <RoomMaterialItem
        accessibilityLabel="Oyuncak Kutusu"
        editable
        materialKey="pastel-toy-box"
        onPlacementChange={jest.fn()}
        placement={{ scale: 1, x: 0.5, y: 0.5 }}
        sceneSize={{ height: 386, width: 360 }}
        zIndex={2}
      />,
    );

    const item = view.getByTestId('room-material-pastel-toy-box');
    expect(item.props.pointerEvents).toBe('auto');
    expect(StyleSheet.flatten(item.props.style)).not.toHaveProperty('backgroundColor');
    expect(StyleSheet.flatten(item.props.style)).not.toHaveProperty('borderWidth');
    expect(view.queryByTestId('remove-room-material-pastel-toy-box')).toBeNull();
  });
});
