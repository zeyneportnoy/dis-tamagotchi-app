import { Image, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

const splashSource = require('../../../assets/splash/denthero-splash.png');

export function BrandedSplash() {
  const { t } = useTranslation();

  return (
    <View
      accessibilityLabel={t('common.loading')}
      accessible
      style={styles.screen}
      testID="denthero-branded-splash"
    >
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={splashSource}
        style={styles.image}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: { height: '100%', width: '100%' },
  screen: {
    alignItems: 'center',
    backgroundColor: '#D9D3F6',
    flex: 1,
    justifyContent: 'center',
  },
});
