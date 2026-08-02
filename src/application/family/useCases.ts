import type {
  ChildProfileRepository,
  CreateChildProfileInput,
  FamilyRepository,
  UpdateChildProfileInput,
} from '@/domain/family';

import { toChildProfileViewModel, type ChildProfileViewModel } from './viewModels';

export class FamilyUseCases {
  constructor(
    private readonly families: FamilyRepository,
    private readonly profiles: ChildProfileRepository,
  ) {}

  async ensureLocalFamily() {
    return (await this.families.getLocal()) ?? this.families.createLocal();
  }

  async createProfile(
    input: Omit<CreateChildProfileInput, 'familyId'>,
  ): Promise<ChildProfileViewModel> {
    const family = await this.ensureLocalFamily();
    return toChildProfileViewModel(await this.profiles.create({ ...input, familyId: family.id }));
  }

  async listProfiles(): Promise<readonly ChildProfileViewModel[]> {
    const family = await this.families.getLocal();
    if (!family) return [];
    return (await this.profiles.list(family.id)).map(toChildProfileViewModel);
  }

  async getActiveProfile(): Promise<ChildProfileViewModel | null> {
    const profile = await this.profiles.getActive();
    return profile ? toChildProfileViewModel(profile) : null;
  }

  selectActiveProfile(profileId: string): Promise<void> {
    return this.profiles.selectActive(profileId);
  }

  async updateProfile(
    profileId: string,
    input: UpdateChildProfileInput,
  ): Promise<ChildProfileViewModel> {
    return toChildProfileViewModel(await this.profiles.update(profileId, input));
  }

  archiveProfile(profileId: string): Promise<void> {
    return this.profiles.archive(profileId);
  }

  deleteProfile(profileId: string): Promise<void> {
    return this.profiles.delete(profileId);
  }
}
