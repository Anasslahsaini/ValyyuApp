/**
 * Passwordless email sign-in with Clerk: one flow for new and existing accounts.
 * The Clerk client is injected (the useSignIn/useSignUp signals), so the flow is testable without Clerk.
 */
type Result = Promise<{ error: unknown }>;

export type EmailCodeClient = {
  signIn: {
    emailCode: {
      sendCode: (p: { emailAddress: string }) => Result;
      verifyCode: (p: { code: string }) => Result;
    };
    finalize: () => Result;
  };
  signUp: {
    create: (p: { emailAddress: string }) => Result;
    verifications: { sendEmailCode: () => Result; verifyEmailCode: (p: { code: string }) => Result };
    finalize: () => Result;
  };
};

export type AuthFlow = 'signIn' | 'signUp';
export type AuthErrorKind =
  'invalid_email' | 'wrong_code' | 'expired' | 'network' | 'linked_google' | 'rate_limited' | 'unknown';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CODE = /^\d{6}$/;

const errorCode = (error: unknown): string | undefined => {
  const e = error as { code?: unknown; errors?: { code?: unknown }[] } | null;
  const nested = e?.errors?.[0]?.code;
  if (typeof nested === 'string') return nested;
  return typeof e?.code === 'string' ? e.code : undefined;
};

/** Maps a Clerk error to what the screens can tell the user. */
export function authErrorKind(error: unknown): AuthErrorKind {
  if (error instanceof TypeError) return 'network';
  switch (errorCode(error)) {
    case 'form_code_incorrect':
    case 'form_param_format_invalid':
      return 'wrong_code';
    case 'verification_expired':
      return 'expired';
    case 'network_error':
      return 'network';
    case 'strategy_for_user_invalid':
    case 'external_account_exists':
      return 'linked_google';
    case 'form_identifier_invalid':
    case 'form_param_format_invalid_email':
      return 'invalid_email';
    case 'too_many_requests':
      return 'rate_limited';
    default:
      return 'unknown';
  }
}

export async function sendEmailCode(
  client: EmailCodeClient,
  rawEmail: string,
): Promise<{ ok: true; flow: AuthFlow } | { ok: false; kind: AuthErrorKind }> {
  const emailAddress = rawEmail.trim().toLowerCase();
  if (!EMAIL.test(emailAddress)) return { ok: false, kind: 'invalid_email' };
  try {
    const signIn = await client.signIn.emailCode.sendCode({ emailAddress });
    if (!signIn.error) return { ok: true, flow: 'signIn' };
    if (errorCode(signIn.error) !== 'form_identifier_not_found')
      return { ok: false, kind: authErrorKind(signIn.error) };

    const created = await client.signUp.create({ emailAddress });
    if (created.error) return { ok: false, kind: authErrorKind(created.error) };
    const sent = await client.signUp.verifications.sendEmailCode();
    return sent.error ? { ok: false, kind: authErrorKind(sent.error) } : { ok: true, flow: 'signUp' };
  } catch (error) {
    return { ok: false, kind: authErrorKind(error) };
  }
}

export async function verifyEmailCode(
  client: EmailCodeClient,
  flow: AuthFlow,
  rawCode: string,
): Promise<{ ok: true } | { ok: false; kind: AuthErrorKind }> {
  const code = rawCode.trim();
  if (!CODE.test(code)) return { ok: false, kind: 'wrong_code' };
  try {
    const verified =
      flow === 'signIn'
        ? await client.signIn.emailCode.verifyCode({ code })
        : await client.signUp.verifications.verifyEmailCode({ code });
    if (verified.error) return { ok: false, kind: authErrorKind(verified.error) };
    const done = flow === 'signIn' ? await client.signIn.finalize() : await client.signUp.finalize();
    return done.error ? { ok: false, kind: authErrorKind(done.error) } : { ok: true };
  } catch (error) {
    return { ok: false, kind: authErrorKind(error) };
  }
}
