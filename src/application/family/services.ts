import type { CreateChildProfileInput, UpdateChildProfileInput } from '@/domain/family';
import { getDatabase } from '@/data/db';
import { SQLiteChildProfileRepository, SQLiteFamilyRepository } from '@/data/repositories';
import { getParentAuthUseCases } from '@/application/auth';
import { pushPendingChildProfiles } from '@/application/sync';
import {
  birthdayReminderService,
  reminderSettingsService,
  syncGroupedBrushingReminders,
} from '@/features/reminders';

import { FamilyUseCases } from './useCases';
import type { ChildProfileViewModel } from './viewModels';

/**
 * Child profiles are still created/updated locally first (offline-first). This
 * wrapper adds the Supabase side: after a successful local write it flushes the
 * now-`pending` row to `public.child_profiles` in the background. The push is
 * fire-and-forget — a failure never blocks the UI or touches local data.
 */
class CloudAwareFamilyUseCases extends FamilyUseCases {
  override async createProfile(
    input: Omit<CreateChildProfileInput, 'familyId'>,
  ): Promise<ChildProfileViewModel> {
    const profile = await super.createProfile(input);
    void pushPendingChildProfiles();
    void this.reconcileChildNotifications(profile);
    return profile;
  }

  override async updateProfile(
    profileId: string,
    input: UpdateChildProfileInput,
  ): Promise<ChildProfileViewModel> {
    const profile = await super.updateProfile(profileId, input);
    void pushPendingChildProfiles();
    void this.reconcileChildNotifications(profile);
    return profile;
  }

  override async archiveProfile(profileId: string): Promise<void> {
    await this.clearChildBrushingSchedule(profileId);
    await super.archiveProfile(profileId);
    void birthdayReminderService.cancelForProfile(profileId);
    void this.reconcileGroupedBrushingReminders();
  }

  override async deleteProfile(profileId: string): Promise<void> {
    await this.clearChildBrushingSchedule(profileId);
    await super.deleteProfile(profileId);
    void birthdayReminderService.cancelForProfile(profileId);
    void this.reconcileGroupedBrushingReminders();
  }

  /**
   * Keeps this child's own yearly birthday notification in step with its saved
   * birth date and nickname, then rebuilds the device's grouped brushing
   * schedule so every title names the right children. Fire-and-forget: notify
   * failures never affect local profile data.
   */
  private async reconcileChildNotifications(profile: ChildProfileViewModel): Promise<void> {
    void birthdayReminderService.scheduleForProfile({
      id: profile.id,
      nickname: profile.nickname,
      dateOfBirth: profile.dateOfBirth,
    });
    await this.reconcileGroupedBrushingReminders();
  }

  private async reconcileGroupedBrushingReminders(): Promise<void> {
    try {
      const parentId = (await getParentAuthUseCases()?.getSession())?.userId;
      if (!parentId) return;
      const children = await this.listProfiles();
      await syncGroupedBrushingReminders(
        parentId,
        children.map((child) => ({ id: child.id, nickname: child.nickname })),
      );
    } catch {
      // grouping is best-effort; each child's stored settings are untouched
    }
  }

  private async clearChildBrushingSchedule(profileId: string): Promise<void> {
    try {
      const parentId = (await getParentAuthUseCases()?.getSession())?.userId;
      if (!parentId) return;
      await reminderSettingsService.clearScheduledNotificationIds(parentId, profileId);
    } catch {
      // The grouped rebuild still sweeps orphaned brushing requests by metadata.
    }
  }
}

let useCasesPromise: Promise<FamilyUseCases> | undefined;

export function getFamilyUseCases(): Promise<FamilyUseCases> {
  useCasesPromise ??= getDatabase().then(
    (database) =>
      new CloudAwareFamilyUseCases(
        new SQLiteFamilyRepository(database),
        new SQLiteChildProfileRepository(database, undefined, undefined, async () => {
          const auth = getParentAuthUseCases();
          return (await auth?.getSession())?.userId ?? null;
        }),
      ),
  );
  return useCasesPromise;
}
