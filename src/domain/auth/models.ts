export type ParentSession = Readonly<{
  userId: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
}>;

export type SignUpInput = Readonly<{
  displayName: string;
  email: string;
  password: string;
}>;

export type SignInInput = Readonly<{ email: string; password: string }>;

export type AuthCallbackInput = Readonly<{
  code?: string;
  flowId?: string;
  accessToken?: string;
  refreshToken?: string;
  type?: string;
}>;
