import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';

import { Button, Text, colors, radii, spacing } from '@/design-system';
import { dateOnlyFromDate, dateOnlyToDate } from '@/domain/family';

type Props = Readonly<{
  visible: boolean;
  title: string;
  cancelLabel: string;
  confirmLabel: string;
  /** Currently stored value ('YYYY-MM-DD'), or null for a fresh pick. */
  value: string | null;
  minimumDate?: Date;
  maximumDate?: Date;
  onCancel: () => void;
  onConfirm: (dateOnly: string) => void;
  testID?: string;
}>;

const noon = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);

export function DentistDatePickerModal({
  cancelLabel,
  confirmLabel,
  maximumDate,
  minimumDate,
  onCancel,
  onConfirm,
  testID,
  title,
  value,
  visible,
}: Props) {
  const resolveValue = (): Date => {
    const parsed = value ? dateOnlyToDate(value) : null;
    return parsed ?? noon(new Date());
  };
  const [pending, setPending] = useState<Date>(resolveValue);

  useEffect(() => {
    if (visible) setPending(resolveValue());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, visible]);

  const handleChange = (event: DateTimePickerEvent, selected?: Date): void => {
    if (event.type === 'dismissed') {
      onCancel();
      return;
    }
    if (selected) setPending(selected);
  };

  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible={visible}>
      <View style={styles.backdrop}>
        <View accessibilityViewIsModal style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <DateTimePicker
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            maximumDate={maximumDate}
            minimumDate={minimumDate}
            mode="date"
            onChange={handleChange}
            testID={testID ? `${testID}-picker` : undefined}
            value={pending}
          />
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button label={cancelLabel} onPress={onCancel} variant="secondary" />
            </View>
            <View style={styles.action}>
              <Button
                label={confirmLabel}
                onPress={() => onConfirm(dateOnlyFromDate(pending))}
                testID={testID ? `${testID}-confirm` : undefined}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  action: { flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(38,50,56,0.42)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.md,
    maxWidth: 430,
    padding: spacing.md,
    width: '100%',
  },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: '900' },
});
