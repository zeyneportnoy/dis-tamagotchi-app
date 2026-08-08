import type {
  BrushingPeriod,
  BrushingSession,
  ChildProfile,
  CompleteBrushingSessionInput,
  CreateChildProfileInput,
  Family,
  ProfileProgress,
  UpdateChildProfileInput,
} from './models';

export interface FamilyRepository {
  getLocal(): Promise<Family | null>;
  createLocal(): Promise<Family>;
}

export interface ProfileProgressRepository {
  get(profileId: string): Promise<ProfileProgress>;
  setBrushingCompleted(
    profileId: string,
    period: BrushingPeriod,
    completed: boolean,
  ): Promise<ProfileProgress>;
}

export interface BrushingSessionRepository {
  complete(input: CompleteBrushingSessionInput): Promise<BrushingSession>;
  listCompleted(profileId: string): Promise<readonly BrushingSession[]>;
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
