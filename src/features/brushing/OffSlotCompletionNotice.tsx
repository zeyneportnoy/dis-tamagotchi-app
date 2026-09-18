import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Text, colors, radii, spacing, typography } from '@/design-system';
import { classifyBrushingSlot } from '@/domain/brushing';

export function shouldShowOffSlotCompletionNotice(
  completed: boolean,
  completedAt: string,
): boolean {
  return completed && classifyBrushingSlot(new Date(completedAt)) === null;
}

type Props = Readonly<{
  onDismiss: () => void;
  visible: boolean;
}>;

export function OffSlotCompletionNotice({ onDismiss, visible }: Props) {
  const { t } = useTranslation();

  return (
    <Modal animationType="fade" onRequestClose={() => undefined} transparent visible={visible}>
      <View style={styles.backdrop} testID="brushing-off-slot-popup">
        <View accessibilityViewIsModal style={styles.card} testID="brushing-off-slot-notice">
          <ScrollView
            bounces={false}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>{t('brushing.offSlotNotice.title')}</Text>
            <Text style={styles.body}>{t('brushing.offSlotNotice.body')}</Text>
            <Text style={styles.hoursTitle}>{t('brushing.offSlotNotice.hoursTitle')}</Text>
            <View style={styles.hours}>
              <Text style={styles.hourLine}>
                {t('brushing.offSlotNotice.morningLabel')}{' '}
                <Text style={styles.emphasis}>{t('brushing.offSlotNotice.morningHours')}</Text>
              </Text>
              <Text style={styles.hourLine}>
                {t('brushing.offSlotNotice.eveningLabel')}{' '}
                <Text style={styles.emphasis}>{t('brushing.offSlotNotice.eveningHours')}</Text>
              </Text>
            </View>
          </ScrollView>
          <Button
            label={t('brushing.offSlotNotice.confirm')}
            onPress={onDismiss}
            testID="brushing-off-slot-confirm"
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(38,50,56,0.38)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.md,
  },
  body: { textAlign: 'center' },
  card: {
    backgroundColor: '#EAF8F6',
    borderColor: '#B9E9E3',
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
    maxHeight: '90%',
    maxWidth: 380,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    width: '100%',
  },
  content: { alignItems: 'center', flexGrow: 1, gap: spacing.sm },
  emphasis: { fontWeight: '900' },
  hourLine: {
    flexShrink: 1,
    fontSize: typography.size.label,
    lineHeight: 22,
    textAlign: 'center',
  },
  hours: { alignItems: 'center', gap: spacing.xs, width: '100%' },
  hoursTitle: { color: colors.brandPrimary, fontWeight: '900', textAlign: 'center' },
  title: { color: colors.success, fontWeight: '900', textAlign: 'center' },
});
