import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { colors, minimumTouchTarget } from '@/design-system';

export default function ChildLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.textPrimary,
        tabBarStyle: { minHeight: minimumTouchTarget + 18 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="tasks" options={{ title: t('tabs.tasks') }} />
      <Tabs.Screen name="collection" options={{ title: t('tabs.collection') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
    </Tabs>
  );
}
