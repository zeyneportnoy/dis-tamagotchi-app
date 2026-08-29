import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button, Text, colors, minimumTouchTarget, radii, spacing } from '@/design-system';
import { dateOnlyFromDate, dateOnlyToDate, formatDateOfBirth } from '@/domain/family';

type Props = Readonly<{
  cancelLabel: string;
  confirmLabel: string;
  dateOfBirth: string | null;
  label: string;
  onChange: (dateOfBirth: string) => void;
  placeholder: string;
  testID?: string;
}>;

const defaultPickerDate = (): Date => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 7);
  date.setHours(12, 0, 0, 0);
  return date;
};

export function DateOfBirthField({
  cancelLabel,
  confirmLabel,
  dateOfBirth,
  label,
  onChange,
  placeholder,
  testID,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pendingDate, setPendingDate] = useState(defaultPickerDate);

  const openPicker = (): void => {
    setPendingDate((dateOfBirth && dateOnlyToDate(dateOfBirth)) || defaultPickerDate());
    setOpen(true);
  };

  const handlePickerChange = (event: DateTimePickerEvent, selectedDate?: Date): void => {
    if (event.type === 'dismissed') {
      setOpen(false);
      return;
    }
    if (selectedDate) setPendingDate(selectedDate);
  };

  const confirm = (): void => {
    onChange(dateOnlyFromDate(pendingDate));
    setOpen(false);
  };

  const displayValue = dateOfBirth ? formatDateOfBirth(dateOfBirth) : placeholder;

  return (
    <>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{label}</Text>
        <Pressable
          accessibilityLabel={`${label}: ${displayValue}`}
          accessibilityRole="button"
          onPress={openPicker}
          style={({ pressed }) => [styles.field, pressed && styles.pressed]}
          testID={testID}
        >
          <Text style={[styles.value, !dateOfBirth && styles.placeholder]}>{displayValue}</Text>
          <Text style={styles.calendarIcon}>▣</Text>
        </Pressable>
      </View>
      <Modal animationType="fade" onRequestClose={() => setOpen(false)} transparent visible={open}>
        <View style={styles.backdrop}>
          <View accessibilityViewIsModal style={styles.modalCard}>
            <Text style={styles.modalTitle}>{label}</Text>
            <DateTimePicker
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              maximumDate={new Date()}
              mode="date"
              onChange={handlePickerChange}
              testID={testID ? `${testID}-picker` : undefined}
              value={pendingDate}
            />
            <View style={styles.actions}>
              <View style={styles.action}>
                <Button label={cancelLabel} onPress={() => setOpen(false)} variant="secondary" />
              </View>
              <View style={styles.action}>
                <Button label={confirmLabel} onPress={confirm} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
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
  calendarIcon: { color: colors.brandPrimary, fontSize: 22, fontWeight: '900' },
  field: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: '#D8CCF5',
    borderRadius: radii.md,
    borderWidth: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: minimumTouchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  fieldGroup: { gap: spacing.xs },
  label: { fontWeight: '800' },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.md,
    maxWidth: 430,
    padding: spacing.md,
    width: '100%',
  },
  modalTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '900' },
  placeholder: { opacity: 0.52 },
  pressed: { opacity: 0.76 },
  value: { flex: 1, fontSize: 17 },
});
