import type {
  ChildProfile,
  CreateChildProfileInput,
  Family,
  UpdateChildProfileInput,
} from './models';

export interface FamilyRepository {
  getLocal(): Promise<Family | null>;
  createLocal(): Promise<Family>;
}

export interface ChildProfileRepository {
  create(input: CreateChildProfileInput): Promise<ChildProfile>;
  list(familyId: string): Promise<readonly ChildProfile[]>;
  getActive(): Promise<ChildProfile | null>;
  selectActive(profileId: string): Promise<void>;
  update(profileId: string, input: UpdateChildProfileInput): Promise<ChildProfile>;
  archive(profileId: string): Promise<void>;
  delete(profileId: string): Promise<void>;
}
