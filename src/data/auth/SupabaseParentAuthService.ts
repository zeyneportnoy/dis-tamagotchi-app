import type { AuthChangeEvent, Session, SupabaseClient, User } from '@supabase/supabase-js';

import { authLinks } from '@/config/authLinks';
import type {
  AuthCallbackInput,
  ParentAuthService,
  ParentSession,
  SignInInput,
  SignUpInput,
} from '@/domain/auth';

const toSession = (user: User): ParentSession => ({
  userId: user.id,
  email: user.email ?? '',
  displayName:
    typeof user.user_metadata.display_name === 'string' ? user.user_metadata.display_name : '',
  emailVerified: Boolean(user.email_confirmed_at),
});

export class SupabaseParentAuthService implements ParentAuthService {
  constructor(private readonly client: SupabaseClient) {}

  async signUp(input: SignUpInput): Promise<ParentSession | null> {
    const { data, error } = await this.client.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: { display_name: input.displayName },
        emailRedirectTo: authLinks.emailVerification,
      },
    });
    if (error) throw new Error(error.status === 429 ? 'AUTH_RATE_LIMIT' : 'AUTH_SIGN_UP_FAILED');
    return data.user ? toSession(data.user) : null;
  }

  async signIn(input: SignInInput): Promise<ParentSession> {
    const { data, error } = await this.client.auth.signInWithPassword(input);
    if (error || !data.user) throw new Error('AUTH_INVALID_CREDENTIALS');
    return toSession(data.user);
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) throw new Error('AUTH_SIGN_OUT_FAILED');
  }

  /**
   * Deletes the account server-side via the `delete-account` Edge Function,
   * which holds the privileged key in its own environment — the client never
   * sees it. The caller's JWT authorises the call and the function derives the
   * user id from that token, not from any argument.
   */
  async deleteAccount(): Promise<void> {
    const { error } = await this.client.functions.invoke('delete-account', { method: 'POST' });
    if (error) throw new Error('AUTH_ACCOUNT_DELETE_FAILED');
    await this.client.auth.signOut().catch(() => undefined);
  }

  async resendVerification(email: string): Promise<void> {
    const { error } = await this.client.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: authLinks.emailVerification },
    });
    if (error) throw new Error(error.status === 429 ? 'AUTH_RATE_LIMIT' : 'AUTH_RESEND_FAILED');
  }

  async sendPasswordReset(email: string): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo: authLinks.passwordReset,
    });
    if (error) throw new Error(error.status === 429 ? 'AUTH_RATE_LIMIT' : 'AUTH_RESET_FAILED');
  }

  async updatePassword(password: string): Promise<void> {
    const { error } = await this.client.auth.updateUser({ password });
    if (error) throw new Error('AUTH_PASSWORD_UPDATE_FAILED');
  }

  async handleCallback(input: AuthCallbackInput): Promise<ParentSession | null> {
    if (input.code) {
      const { data, error } = await this.client.auth.exchangeCodeForSession(
        input.code,
        input.flowId ? { flowId: input.flowId } : undefined,
      );
      if (error) throw new Error('AUTH_CALLBACK_FAILED');
      return data.user ? toSession(data.user) : null;
    }
    if (input.accessToken && input.refreshToken) {
      const { data, error } = await this.client.auth.setSession({
        access_token: input.accessToken,
        refresh_token: input.refreshToken,
      });
      if (error) throw new Error('AUTH_CALLBACK_FAILED');
      return data.user ? toSession(data.user) : null;
    }
    throw new Error('AUTH_CALLBACK_INVALID');
  }

  async getSession(): Promise<ParentSession | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw new Error('AUTH_SESSION_FAILED');
    return data.session ? toSession(data.session.user) : null;
  }

  async getCurrentUser(): Promise<ParentSession | null> {
    const { data, error } = await this.client.auth.getUser();
    if (error) return null;
    return data.user ? toSession(data.user) : null;
  }

  subscribe(listener: (session: ParentSession | null) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) =>
        listener(session ? toSession(session.user) : null),
    );
    return () => data.subscription.unsubscribe();
  }
}
