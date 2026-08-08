import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, minimumTouchTarget, radii } from '../theme';
import { Text } from './Text';

type Props = { fallbackHref?: Href; onPress?: () => void; testID?: string };

export function BackButton({ fallbackHref = '/', onPress, testID }: Props) {
  const { t } = useTranslation();
  const goBack = (): void => {
    if (onPress) return onPress();
    if (router.canGoBack()) return router.back();
    router.replace(fallbackHref);
  };
  return (
    <Pressable
      accessibilityLabel={t('navigation.back')}
      accessibilityRole="button"
      hitSlop={8}
      onPress={goBack}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      testID={testID}
    >
      <Text style={styles.icon}>❮</Text>
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
  icon: { color: colors.brandPrimary, fontSize: 24, fontWeight: '800', lineHeight: 28 },
  pressed: { opacity: 0.7 },
});
