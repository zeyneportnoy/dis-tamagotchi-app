import type { Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { colors, spacing, typography } from '../theme';
import { BackButton } from './BackButton';
import { Text } from './Text';

type Props = Readonly<{
  backTestID?: string;
  fallbackHref: Href;
  onBackPress?: () => void;
  title: string;
}>;

export function ScreenHeader({ backTestID, fallbackHref, onBackPress, title }: Props) {
  return (
    <View style={styles.header}>
      <BackButton fallbackHref={fallbackHref} onPress={onBackPress} testID={backTestID} />
      <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <View style={styles.balance} />
    </View>
  );
}

const styles = StyleSheet.create({
  balance: { height: 48, width: 48 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 56,
    paddingVertical: spacing.xs,
    width: '100%',
  },
  title: {
    color: colors.navy,
    flex: 1,
    fontFamily: typography.family.display,
    fontSize: 23,
    fontWeight: '700',
    lineHeight: 29,
    paddingHorizontal: spacing.xs,
    textAlign: 'center',
  },
});
