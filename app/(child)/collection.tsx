import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Screen, Text, colors, radii, spacing } from '@/design-system';

export default function CollectionScreen() {
  const { t } = useTranslation();
  return (
    <Screen style={styles.screen} testID="collection-screen">
      <Text style={styles.heading} variant="title">
        {t('placeholders.collectionTitle')}
      </Text>
      <View style={styles.hero}>
        <View style={styles.backStar}>
          <Text style={styles.icon}>★</Text>
        </View>
        <Text style={styles.smallStarLeft}>✦</Text>
        <Text style={styles.smallStarRight}>✦</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.center}>{t('placeholders.collectionBody')}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  backStar: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    height: 160,
    justifyContent: 'center',
    width: 160,
  },
  center: { textAlign: 'center' },
  heading: { textAlign: 'center' },
  hero: {
    alignItems: 'center',
    backgroundColor: '#F9D7E5',
    borderRadius: 34,
    height: 300,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  icon: { color: colors.brandHighlight, fontSize: 88, lineHeight: 100 },
  screen: { justifyContent: 'center' },
  smallStarLeft: {
    color: colors.brandPrimary,
    fontSize: 28,
    left: spacing.lg,
    position: 'absolute',
    top: 62,
  },
  smallStarRight: {
    bottom: 50,
    color: colors.brandSecondary,
    fontSize: 30,
    position: 'absolute',
    right: spacing.lg,
  },
});
