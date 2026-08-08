import { Tabs } from 'expo-router';
import { type ColorValue, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text, colors, minimumTouchTarget } from '@/design-system';

function TabIcon({ active, symbol }: { active: boolean; symbol: string }) {
  return (
    <Text style={[styles.icon, active ? styles.iconActive : styles.iconInactive]}>{symbol}</Text>
  );
}

function TabLabel({ color, label }: { color: ColorValue; label: string }) {
  return (
    <Text numberOfLines={1} style={[styles.label, { color }]}>
      {label}
    </Text>
  );
}

export default function ChildLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.textPrimary,
        tabBarStyle: styles.bar,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon active={focused} symbol="🏠" />,
          tabBarLabel: ({ color }) => <TabLabel color={color} label={t('tabs.home')} />,
          title: t('tabs.home'),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon active={focused} symbol="📋" />,
          tabBarLabel: ({ color }) => <TabLabel color={color} label={t('tabs.tasks')} />,
          title: t('tabs.tasks'),
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon active={focused} symbol="⭐" />,
          tabBarLabel: ({ color }) => <TabLabel color={color} label={t('tabs.collection')} />,
          title: t('tabs.collection'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon active={focused} symbol="☺" />,
          tabBarLabel: ({ color }) => <TabLabel color={color} label={t('tabs.profile')} />,
          title: t('tabs.profile'),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.white,
    borderTopColor: '#EEE8E3',
    height: 78,
    paddingBottom: 8,
    paddingTop: 6,
  },
  icon: { fontSize: 23, fontWeight: '800', lineHeight: 28, minHeight: 28 },
  iconActive: { opacity: 1 },
  iconInactive: { opacity: 0.42 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
    minHeight: minimumTouchTarget / 2,
    textAlign: 'center',
  },
});
