import { Tabs, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, type ColorValue, type ImageSourcePropType, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getFamilyUseCases } from '@/application/family';
import { Text, colors, minimumTouchTarget } from '@/design-system';
import type { StarterAvatarKey } from '@/domain/family';
import {
  characterIconSource,
  sceneBackgroundForCharacter,
  type CharacterIconName,
} from '@/features/character';

function TabIcon({ active, source }: { active: boolean; source: ImageSourcePropType }) {
  return (
    <Image
      source={source}
      style={[styles.icon, active ? styles.iconActive : styles.iconInactive]}
    />
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
  const [characterKey, setCharacterKey] = useState<StarterAvatarKey>('inci');

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      void getFamilyUseCases()
        .then((family) => family.getActiveProfile())
        .then((profile) => {
          if (mounted && profile) setCharacterKey(profile.avatarId);
        });
      return () => {
        mounted = false;
      };
    }, []),
  );

  const icon = (name: CharacterIconName) => characterIconSource(characterKey, name);
  const backgroundColor = sceneBackgroundForCharacter(characterKey);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor },
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.textPrimary,
        tabBarStyle: styles.bar,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon active={focused} source={icon('home')} />,
          tabBarLabel: ({ color }) => <TabLabel color={color} label={t('tabs.home')} />,
          title: t('tabs.home'),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon active={focused} source={icon('tasks')} />,
          tabBarLabel: ({ color }) => <TabLabel color={color} label={t('tabs.tasks')} />,
          title: t('tabs.tasks'),
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon active={focused} source={icon('collection')} />,
          tabBarLabel: ({ color }) => <TabLabel color={color} label={t('tabs.collection')} />,
          title: t('tabs.collection'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon active={focused} source={icon('profile')} />,
          tabBarLabel: ({ color }) => <TabLabel color={color} label={t('tabs.profile')} />,
          title: t('tabs.profile'),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderTopColor: '#EEE8E3',
    height: 78,
    paddingBottom: 8,
    paddingTop: 6,
  },
  icon: { height: 28, width: 28 },
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
