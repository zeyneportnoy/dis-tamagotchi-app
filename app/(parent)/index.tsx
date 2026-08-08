import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { StyleSheet, View } from 'react-native';

import { BackButton, Button, Screen, Text, spacing } from '@/design-system';

export default function ParentPlaceholderScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <View style={styles.back}>
        <BackButton onPress={() => router.replace('/(child)/profile')} />
      </View>
      <Text variant="title">{t('parent.title')}</Text>
      <Text>{t('parent.placeholder')}</Text>
      <Button
        label={t('parent.addProfile')}
        onPress={() => router.push('/onboarding/accountless')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { left: spacing.lg, position: 'absolute', top: spacing.md },
});
