import { createContext, type PropsWithChildren, useContext, useMemo, useState } from 'react';

import type { AgeBand, StarterAvatarKey } from '@/domain/family';

type Draft = {
  profileId: string | null;
  nickname: string;
  dateOfBirth: string | null;
  ageBand: AgeBand | null;
  avatarId: StarterAvatarKey | null;
  // Reminder choices picked before the child profile exists; applied per-child
  // once the profile is created.
  remindersEnabled: boolean;
  morningReminderTime: string;
  eveningReminderTime: string;
};

type DraftContextValue = Draft & {
  setNickname: (nickname: string) => void;
  setDateOfBirth: (dateOfBirth: string) => void;
  setAgeBand: (ageBand: AgeBand | null) => void;
  setAvatarId: (avatarId: StarterAvatarKey) => void;
  setReminderChoice: (choice: {
    enabled: boolean;
    morningTime?: string;
    eveningTime?: string;
  }) => void;
  beginExistingProfile: (profile: {
    id: string;
    nickname?: string | null;
    dateOfBirth?: string | null;
    ageBand?: AgeBand | null;
    avatarId?: StarterAvatarKey | null;
  }) => void;
  reset: () => void;
};

const initialDraft: Draft = {
  profileId: null,
  nickname: '',
  dateOfBirth: null,
  ageBand: null,
  avatarId: null,
  remindersEnabled: false,
  morningReminderTime: '08:00',
  eveningReminderTime: '20:30',
};
const DraftContext = createContext<DraftContextValue | null>(null);

export function OnboardingDraftProvider({ children }: PropsWithChildren) {
  const [draft, setDraft] = useState(initialDraft);
  const value = useMemo<DraftContextValue>(
    () => ({
      ...draft,
      setNickname: (nickname) => setDraft((current) => ({ ...current, nickname })),
      setDateOfBirth: (dateOfBirth) => setDraft((current) => ({ ...current, dateOfBirth })),
      setAgeBand: (ageBand) => setDraft((current) => ({ ...current, ageBand })),
      setAvatarId: (avatarId) => setDraft((current) => ({ ...current, avatarId })),
      setReminderChoice: (choice) =>
        setDraft((current) => ({
          ...current,
          remindersEnabled: choice.enabled,
          morningReminderTime: choice.morningTime ?? current.morningReminderTime,
          eveningReminderTime: choice.eveningTime ?? current.eveningReminderTime,
        })),
      beginExistingProfile: (profile) =>
        setDraft({
          ...initialDraft,
          profileId: profile.id,
          nickname: profile.nickname ?? '',
          dateOfBirth: profile.dateOfBirth ?? null,
          ageBand: profile.ageBand ?? null,
          avatarId: profile.avatarId ?? null,
        }),
      reset: () => setDraft(initialDraft),
    }),
    [draft],
  );
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useOnboardingDraft(): DraftContextValue {
  const value = useContext(DraftContext);
  if (!value) throw new Error('OnboardingDraftProvider is missing');
  return value;
}
