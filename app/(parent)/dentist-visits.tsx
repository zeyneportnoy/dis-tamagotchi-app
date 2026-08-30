import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getFamilyUseCases } from '@/application/family';
import { Button, Screen, ScreenHeader, Text, colors, radii, spacing } from '@/design-system';
import { formatDateOfBirth } from '@/domain/family';
import { useAuth } from '@/features/auth';
import {
  DentistDatePickerModal,
  dentistVisitService,
  type DentistVisitState,
} from '@/features/reminders';

type ActiveChild = Readonly<{ id: string; nickname: string }>;

const emptyState: DentistVisitState = {
  appointmentReminderDate: null,
  appointmentScheduled: false,
  lastVisitDate: null,
  nextAppointmentDate: null,
  routineDueDate: null,
  routineScheduled: false,
};

export default function DentistVisitsScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [child, setChild] = useState<ActiveChild | null>(null);
  const [state, setState] = useState<DentistVisitState>(emptyState);
  const [routinePickerOpen, setRoutinePickerOpen] = useState(false);
  const [appointmentPickerOpen, setAppointmentPickerOpen] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!session?.userId) return;
      let active = true;
      void getFamilyUseCases()
        .then((useCases) => useCases.getActiveProfile())
        .then(async (profile) => {
          if (!active || !profile) return;
          const next: ActiveChild = { id: profile.id, nickname: profile.nickname };
          setChild(next);
          setState(await dentistVisitService.get(next.id));
        })
        .catch(() => {
          if (active) setFailed(true);
        });
      return () => {
        active = false;
      };
    }, [session?.userId]),
  );

  const runUpdate = async (
    apply: (target: ActiveChild) => Promise<{ permissionDenied: boolean } | void>,
  ): Promise<void> => {
    if (!child || busy) return;
    setBusy(true);
    setFailed(false);
    setPermissionDenied(false);
    try {
      const result = await apply(child);
      if (result?.permissionDenied) setPermissionDenied(true);
      setState(await dentistVisitService.get(child.id));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const routineDone = Boolean(state.lastVisitDate);
  const appointmentDone = Boolean(state.nextAppointmentDate);

  return (
    <Screen style={styles.screen} testID="dentist-visits-screen">
      <ScreenHeader
        backTestID="dentist-visits-back-button"
        fallbackHref="/(parent)/settings"
        onBackPress={() => router.replace('/(parent)/settings')}
        title={t('parent.dentistVisits.title')}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* A. Rutin kontrol */}
        <View style={styles.section} testID="dentist-routine-section">
          <Text style={styles.sectionTitle}>{t('parent.dentistVisits.routine.title')}</Text>
          {routineDone ? (
            <>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>
                  {t('parent.dentistVisits.routine.lastVisitLabel')}
                </Text>
                <Text style={styles.rowValue}>{formatDateOfBirth(state.lastVisitDate!)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>
                  {t('parent.dentistVisits.routine.nextCheckLabel')}
                </Text>
                <Text style={styles.rowValue}>{formatDateOfBirth(state.routineDueDate!)}</Text>
              </View>
              <Text style={styles.explainer}>{t('parent.dentistVisits.routine.explainer')}</Text>
              <Button
                disabled={busy}
                label={t('parent.dentistVisits.routine.change')}
                onPress={() => setRoutinePickerOpen(true)}
                testID="dentist-routine-change"
                variant="secondary"
              />
            </>
          ) : (
            <Button
              disabled={busy}
              label={t('parent.dentistVisits.routine.add')}
              onPress={() => setRoutinePickerOpen(true)}
              testID="dentist-routine-add"
              variant="secondary"
            />
          )}
        </View>

        {/* B. Bir sonraki randevum */}
        <View style={styles.section} testID="dentist-appointment-section">
          <Text style={styles.sectionTitle}>{t('parent.dentistVisits.appointment.title')}</Text>
          {appointmentDone ? (
            <>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>
                  {t('parent.dentistVisits.appointment.visitLabel')}
                </Text>
                <Text style={styles.rowValue}>
                  {formatDateOfBirth(state.nextAppointmentDate!)}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>
                  {t('parent.dentistVisits.appointment.reminderLabel')}
                </Text>
                <Text style={styles.rowValue}>
                  {formatDateOfBirth(state.appointmentReminderDate!)}
                </Text>
              </View>
              <Text style={styles.explainer}>
                {t('parent.dentistVisits.appointment.explainer')}
              </Text>
              <Button
                disabled={busy}
                label={t('parent.dentistVisits.appointment.change')}
                onPress={() => setAppointmentPickerOpen(true)}
                testID="dentist-appointment-change"
                variant="secondary"
              />
              <Button
                disabled={busy}
                label={t('parent.dentistVisits.appointment.remove')}
                onPress={() =>
                  void runUpdate((target) => dentistVisitService.clearNextAppointment(target.id))
                }
                testID="dentist-appointment-remove"
                variant="secondary"
              />
            </>
          ) : (
            <Button
              disabled={busy}
              label={t('parent.dentistVisits.appointment.add')}
              onPress={() => setAppointmentPickerOpen(true)}
              testID="dentist-appointment-add"
              variant="secondary"
            />
          )}
        </View>

        {permissionDenied ? (
          <Text style={styles.notice}>{t('parent.dentistVisits.permissionDenied')}</Text>
        ) : null}
        {failed ? <Text style={styles.error}>{t('parent.dentistVisits.error')}</Text> : null}
      </ScrollView>

      <DentistDatePickerModal
        cancelLabel={t('common.cancel')}
        confirmLabel={t('common.done')}
        maximumDate={new Date()}
        onCancel={() => setRoutinePickerOpen(false)}
        onConfirm={(date) => {
          setRoutinePickerOpen(false);
          void runUpdate((target) => dentistVisitService.setLastVisitDate(target, date));
        }}
        testID="dentist-routine-picker"
        title={t('parent.dentistVisits.routine.pickerTitle')}
        value={state.lastVisitDate}
        visible={routinePickerOpen}
      />
      <DentistDatePickerModal
        cancelLabel={t('common.cancel')}
        confirmLabel={t('common.done')}
        minimumDate={new Date()}
        onCancel={() => setAppointmentPickerOpen(false)}
        onConfirm={(date) => {
          setAppointmentPickerOpen(false);
          void runUpdate((target) => dentistVisitService.setNextAppointmentDate(target, date));
        }}
        testID="dentist-appointment-picker"
        title={t('parent.dentistVisits.appointment.pickerTitle')}
        value={state.nextAppointmentDate}
        visible={appointmentPickerOpen}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  error: { color: colors.danger, fontWeight: '800' },
  explainer: { color: colors.textPrimary, lineHeight: 20, opacity: 0.66 },
  notice: { color: colors.brandSecondary, fontWeight: '700' },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  rowLabel: { color: colors.navy, flexShrink: 1, fontWeight: '800' },
  rowValue: { color: colors.brandPrimary, fontWeight: '800' },
  screen: { gap: spacing.lg, justifyContent: 'flex-start' },
  section: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.md,
  },
  sectionTitle: { color: colors.brandPrimary, fontSize: 19, fontWeight: '900' },
});
