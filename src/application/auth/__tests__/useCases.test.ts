import type { ParentAuthService, ParentSession } from '@/domain/auth';

import { ParentAuthUseCases } from '../useCases';

const session: ParentSession = {
  userId: 'parent-1',
  email: 'veli@example.com',
  displayName: 'Zeynep',
  emailVerified: false,
};

const createService = (): jest.Mocked<ParentAuthService> => ({
  signUp: jest.fn().mockResolvedValue(session),
  signIn: jest.fn().mockResolvedValue(session),
  signOut: jest.fn().mockResolvedValue(undefined),
  resendVerification: jest.fn().mockResolvedValue(undefined),
  sendPasswordReset: jest.fn().mockResolvedValue(undefined),
  updatePassword: jest.fn().mockResolvedValue(undefined),
  handleCallback: jest.fn().mockResolvedValue(session),
  getSession: jest.fn().mockResolvedValue(session),
  getCurrentUser: jest.fn().mockResolvedValue(session),
  subscribe: jest.fn().mockReturnValue(jest.fn()),
});

describe('ParentAuthUseCases', () => {
  it('normalizes a valid signup and requires both legal acknowledgements', async () => {
    const service = createService();
    const useCases = new ParentAuthUseCases(service);
    await useCases.signUp({
      displayName: ' Zeynep ',
      email: ' VELI@EXAMPLE.COM ',
      password: 'guvenli8',
      passwordConfirmation: 'guvenli8',
      termsAccepted: true,
      privacyAcknowledged: true,
    });
    expect(service.signUp).toHaveBeenCalledWith({
      displayName: 'Zeynep',
      email: 'veli@example.com',
      password: 'guvenli8',
    });
    expect(() =>
      useCases.signUp({
        displayName: 'Zeynep',
        email: 'veli@example.com',
        password: 'guvenli8',
        passwordConfirmation: 'guvenli8',
        termsAccepted: false,
        privacyAcknowledged: true,
      }),
    ).toThrow();
  });

  it('rejects invalid email, short password and mismatched confirmation', async () => {
    const useCases = new ParentAuthUseCases(createService());
    expect(() =>
      useCases.signUp({
        displayName: 'Zeynep',
        email: 'not-email',
        password: 'short',
        passwordConfirmation: 'different',
        termsAccepted: true,
        privacyAcknowledged: true,
      }),
    ).toThrow();
  });

  it('uses a privacy-safe reset boundary and validates a new password', async () => {
    const service = createService();
    const useCases = new ParentAuthUseCases(service);
    await useCases.sendPasswordReset({ email: ' VELI@EXAMPLE.COM ' });
    expect(service.sendPasswordReset).toHaveBeenCalledWith('veli@example.com');
    expect(() =>
      useCases.updatePassword({ password: 'guvenli8', passwordConfirmation: 'different8' }),
    ).toThrow();
  });

  it('preserves the PKCE flow id at the callback boundary', async () => {
    const service = createService();
    const useCases = new ParentAuthUseCases(service);
    await useCases.handleCallback({ code: 'auth-code', flowId: 'flow-id' });
    expect(service.handleCallback).toHaveBeenCalledWith({
      code: 'auth-code',
      flowId: 'flow-id',
    });
  });
});
