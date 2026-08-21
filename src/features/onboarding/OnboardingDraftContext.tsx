import { createContext, type PropsWithChildren, useContext, useMemo, useState } from 'react';

import type { AgeBand, StarterAvatarKey } from '@/domain/family';

type Draft = {
  profileId: string | null;
  nickname: string;
  ageBand: AgeBand | null;
  avatarId: StarterAvatarKey | null;
};

type DraftContextValue = Draft & {
  setNickname: (nickname: string) => void;
  setAgeBand: (ageBand: AgeBand) => void;
  setAvatarId: (avatarId: StarterAvatarKey) => void;
  beginExistingProfile: (profile: {
    id: string;
    nickname?: string | null;
    ageBand?: AgeBand | null;
    avatarId?: StarterAvatarKey | null;
  }) => void;
  reset: () => void;
};

const initialDraft: Draft = { profileId: null, nickname: '', ageBand: null, avatarId: null };
const DraftContext = createContext<DraftContextValue | null>(null);

export function OnboardingDraftProvider({ children }: PropsWithChildren) {
  const [draft, setDraft] = useState(initialDraft);
  const value = useMemo<DraftContextValue>(
    () => ({
      ...draft,
      setNickname: (nickname) => setDraft((current) => ({ ...current, nickname })),
      setAgeBand: (ageBand) => setDraft((current) => ({ ...current, ageBand })),
      setAvatarId: (avatarId) => setDraft((current) => ({ ...current, avatarId })),
      beginExistingProfile: (profile) =>
        setDraft({
          profileId: profile.id,
          nickname: profile.nickname ?? '',
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
