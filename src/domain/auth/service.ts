import type { AuthCallbackInput, ParentSession, SignInInput, SignUpInput } from './models';

export interface ParentAuthService {
  signUp(input: SignUpInput): Promise<ParentSession | null>;
  signIn(input: SignInInput): Promise<ParentSession>;
  signOut(): Promise<void>;
  /** Permanently deletes the authenticated account and all of its cloud data. */
  deleteAccount(): Promise<void>;
  resendVerification(email: string): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  handleCallback(input: AuthCallbackInput): Promise<ParentSession | null>;
  getSession(): Promise<ParentSession | null>;
  getCurrentUser(): Promise<ParentSession | null>;
  subscribe(listener: (session: ParentSession | null) => void): () => void;
}
