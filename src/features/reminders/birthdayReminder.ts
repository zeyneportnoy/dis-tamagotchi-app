import * as Notifications from 'expo-notifications';

/** The child data a birthday notification is built from. */
export type BirthdayReminderProfile = Readonly<{
  id: string;
  nickname: string;
  dateOfBirth: string | null;
}>;

/** Stable per-child identifier so a previously-scheduled one can be found and cancelled. */
const identifierFor = (childProfileId: string): string => `birthday-${childProfileId}`;

class BirthdayReminderService {
  /**
   * Birth dates are no longer collected, so a birthday notification is never
   * scheduled — this only cancels whatever birthday notification a prior app
   * version may already have scheduled for this child (from a `dateOfBirth`
   * that predates the product change). `family/services.ts` still calls this
   * on every profile create/update, so this stays the single choke point that
   * guarantees no birthday notification survives, old or new.
   */
  async scheduleForProfile(profile: BirthdayReminderProfile): Promise<void> {
    await this.cancelForProfile(profile.id);
  }

  async cancelForProfile(childProfileId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(identifierFor(childProfileId)).catch(
      () => undefined,
    );
  }
}

export const birthdayReminderService = new BirthdayReminderService();
