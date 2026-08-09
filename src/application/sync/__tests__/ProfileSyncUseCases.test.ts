import type { CloudChildProfileRepository, LocalProfileSyncRepository } from '@/domain/sync';

import { ProfileSyncUseCases } from '../ProfileSyncUseCases';

const profile = {
  id: '11111111-1111-4111-8111-111111111111',
  parentId: '',
  nickname: 'Ege',
  ageBand: '4_6' as const,
  avatarId: 'cheerful-incisor' as const,
  createdAt: '2026-08-08T10:00:00.000Z',
  updatedAt: '2026-08-08T10:00:00.000Z',
  archivedAt: null,
};

const local = (): jest.Mocked<LocalProfileSyncRepository> => ({
  listClaimable: jest.fn().mockResolvedValue([profile]),
  countClaimable: jest.fn().mockResolvedValue(1),
  upsertCloud: jest.fn().mockResolvedValue(undefined),
  markSynced: jest.fn().mockResolvedValue(undefined),
  markFailed: jest.fn().mockResolvedValue(undefined),
});

const cloud = (): jest.Mocked<CloudChildProfileRepository> => ({
  listOwned: jest.fn().mockResolvedValue([{ ...profile, parentId: 'parent-1' }]),
  upsert: jest.fn().mockImplementation((value) => Promise.resolve(value)),
});

describe('ProfileSyncUseCases', () => {
  it('claims a legacy profile without changing its identity', async () => {
    const localRepository = local();
    const useCases = new ProfileSyncUseCases(localRepository, cloud());
    await expect(useCases.claimLegacyProfiles('parent-1')).resolves.toBe(1);
    expect(localRepository.listClaimable).toHaveBeenCalledWith('parent-1');
    expect(localRepository.markSynced).toHaveBeenCalledWith(profile.id, 'parent-1', profile.id);
  });

  it('hydrates cloud profiles into local cache and never deletes local data on failure', async () => {
    const localRepository = local();
    const cloudRepository = cloud();
    const useCases = new ProfileSyncUseCases(localRepository, cloudRepository);
    await expect(useCases.recoverFromCloud()).resolves.toBe(1);
    expect(localRepository.upsertCloud).toHaveBeenCalledWith(
      expect.objectContaining({ id: profile.id, parentId: 'parent-1' }),
    );

    cloudRepository.upsert.mockRejectedValueOnce(new Error('offline'));
    await expect(useCases.claimLegacyProfiles('parent-1')).resolves.toBe(0);
    expect(localRepository.markFailed).toHaveBeenCalledWith(profile.id);
  });
});
