import { Pressable, StyleSheet } from 'react-native';

import { colors, minimumTouchTarget, radii, spacing } from '../theme';
import { Text } from './Text';

type Props = { label: string; selected: boolean; onPress: () => void; testID?: string };

export function SelectionCard({ label, onPress, selected, testID }: Props) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.card, selected && styles.selected]}
      testID={testID}
    >
      <Text>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderColor: colors.indigo,
    borderRadius: radii.md,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: minimumTouchTarget,
    padding: spacing.md,
  },
  selected: { backgroundColor: '#E7E7FC', borderColor: colors.teal },
});
