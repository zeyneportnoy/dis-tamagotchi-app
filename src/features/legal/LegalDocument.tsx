import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton, Screen, Text, colors, radii, spacing } from '@/design-system';

type Props = Readonly<{
  title: string;
  sections: readonly string[];
  placeholder: string;
  incomplete: string;
}>;

export function LegalDocument({ incomplete, placeholder, sections, title }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Screen style={styles.screen}>
      <View style={[styles.back, { top: insets.top + spacing.sm }]} testID="legal-back-safe-area">
        <BackButton fallbackHref="/auth/signup" />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        testID="legal-document-scroll"
      >
        <Text variant="title">{title}</Text>
        <View style={styles.notice}>
          <Text>{placeholder}</Text>
        </View>
        {sections.map((section) => (
          <View key={section} style={styles.card}>
            <Text style={styles.heading}>{section}</Text>
            <Text>{incomplete}</Text>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { left: spacing.lg, position: 'absolute', zIndex: 2 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  content: { gap: spacing.md, paddingBottom: spacing.xl, paddingTop: 72 },
  heading: { fontWeight: '900' },
  notice: { backgroundColor: '#FFF0C9', borderRadius: radii.md, padding: spacing.md },
  screen: { justifyContent: 'flex-start', padding: 0, paddingHorizontal: spacing.lg },
});
