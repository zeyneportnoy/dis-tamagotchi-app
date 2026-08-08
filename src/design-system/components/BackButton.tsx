import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, minimumTouchTarget, radii } from '../theme';
import { Text } from './Text';

type Props = { onPress?: () => void; testID?: string };

export function BackButton({ onPress = () => router.back(), testID }: Props) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityLabel={t('navigation.back')}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      testID={testID}
    >
      <Text style={styles.icon}>‹</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    height: minimumTouchTarget,
    justifyContent: 'center',
    width: minimumTouchTarget,
  },
  icon: { color: colors.brandPrimary, fontSize: 38, fontWeight: '700', lineHeight: 42 },
  pressed: { opacity: 0.7 },
});
