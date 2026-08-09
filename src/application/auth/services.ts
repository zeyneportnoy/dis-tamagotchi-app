import { getSupabaseClient, SupabaseParentAuthService } from '@/data/auth';

import { ParentAuthUseCases } from './useCases';

let authUseCases: ParentAuthUseCases | null | undefined;

export function getParentAuthUseCases(): ParentAuthUseCases | null {
  if (authUseCases !== undefined) return authUseCases;
  const client = getSupabaseClient();
  authUseCases = client ? new ParentAuthUseCases(new SupabaseParentAuthService(client)) : null;
  return authUseCases;
}
