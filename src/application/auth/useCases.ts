import type { ParentAuthService, ParentSession } from '@/domain/auth';
import {
  authCallbackSchema,
  passwordResetRequestSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from '@/domain/auth';

export class ParentAuthUseCases {
  constructor(private readonly service: ParentAuthService) {}

  signUp(input: unknown): Promise<ParentSession | null> {
    const value = signUpSchema.parse(input);
    return this.service.signUp({
      displayName: value.displayName,
      email: value.email,
      password: value.password,
    });
  }

  signIn(input: unknown): Promise<ParentSession> {
    return this.service.signIn(signInSchema.parse(input));
  }

  signOut(): Promise<void> {
    return this.service.signOut();
  }

  resendVerification(email: string): Promise<void> {
    return this.service.resendVerification(passwordResetRequestSchema.parse({ email }).email);
  }

  sendPasswordReset(input: unknown): Promise<void> {
    return this.service.sendPasswordReset(passwordResetRequestSchema.parse(input).email);
  }

  updatePassword(input: unknown): Promise<void> {
    return this.service.updatePassword(updatePasswordSchema.parse(input).password);
  }

  handleCallback(input: unknown): Promise<ParentSession | null> {
    return this.service.handleCallback(authCallbackSchema.parse(input));
  }

  getSession(): Promise<ParentSession | null> {
    return this.service.getSession();
  }

  getCurrentUser(): Promise<ParentSession | null> {
    return this.service.getCurrentUser();
  }

  subscribe(listener: (session: ParentSession | null) => void): () => void {
    return this.service.subscribe(listener);
  }
}
