import type { ProfileProgress } from '@/domain/family';

type ProgressListener = (progress: ProfileProgress) => void;

const listeners = new Set<ProgressListener>();

export function notifyChildProgressChanged(progress: ProfileProgress): void {
  for (const listener of listeners) listener(progress);
}

export function subscribeToChildProgressChanges(listener: ProgressListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
