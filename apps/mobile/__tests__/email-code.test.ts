import { authErrorKind, sendEmailCode, verifyEmailCode, type EmailCodeClient } from '../src/auth/email-code';

const ok = { error: null };
const fail = (code: string) => ({ error: Object.assign(new Error(code), { code }) });
const apiFail = (code: string) => ({
  error: Object.assign(new Error('api'), { code: 'api_response_error', errors: [{ code }] }),
});

function client(
  overrides: {
    signInSend?: unknown;
    signInVerify?: unknown;
    signUpCreate?: unknown;
    signUpVerify?: unknown;
  } = {},
) {
  const c = {
    signIn: {
      emailCode: {
        sendCode: jest.fn().mockResolvedValue(overrides.signInSend ?? ok),
        verifyCode: jest.fn().mockResolvedValue(overrides.signInVerify ?? ok),
      },
      finalize: jest.fn().mockResolvedValue(ok),
    },
    signUp: {
      create: jest.fn().mockResolvedValue(overrides.signUpCreate ?? ok),
      verifications: {
        sendEmailCode: jest.fn().mockResolvedValue(ok),
        verifyEmailCode: jest.fn().mockResolvedValue(overrides.signUpVerify ?? ok),
      },
      finalize: jest.fn().mockResolvedValue(ok),
    },
  };
  return c as typeof c & EmailCodeClient;
}

describe('sendEmailCode', () => {
  it('signs in an existing account', async () => {
    const c = client();
    await expect(sendEmailCode(c, ' Rayan@Exemple.fr ')).resolves.toEqual({ ok: true, flow: 'signIn' });
    expect(c.signIn.emailCode.sendCode).toHaveBeenCalledWith({ emailAddress: 'rayan@exemple.fr' });
    expect(c.signUp.create).not.toHaveBeenCalled();
  });

  it('creates the account when the email is new', async () => {
    const c = client({ signInSend: apiFail('form_identifier_not_found') });
    await expect(sendEmailCode(c, 'new@exemple.fr')).resolves.toEqual({ ok: true, flow: 'signUp' });
    expect(c.signUp.create).toHaveBeenCalledWith({ emailAddress: 'new@exemple.fr' });
    expect(c.signUp.verifications.sendEmailCode).toHaveBeenCalled();
  });

  it('refuses an invalid address before calling Clerk', async () => {
    const c = client();
    await expect(sendEmailCode(c, 'rayan@exemple')).resolves.toEqual({ ok: false, kind: 'invalid_email' });
    expect(c.signIn.emailCode.sendCode).not.toHaveBeenCalled();
  });

  it('reports a network failure', async () => {
    const c = client({ signInSend: fail('network_error') });
    await expect(sendEmailCode(c, 'rayan@exemple.fr')).resolves.toEqual({ ok: false, kind: 'network' });
  });

  it('reports an account that only signs in with Google', async () => {
    const c = client({ signInSend: apiFail('strategy_for_user_invalid') });
    await expect(sendEmailCode(c, 'rayan@exemple.fr')).resolves.toEqual({ ok: false, kind: 'linked_google' });
  });
});

describe('verifyEmailCode', () => {
  it('verifies and opens the session (sign in)', async () => {
    const c = client();
    await expect(verifyEmailCode(c, 'signIn', '482719')).resolves.toEqual({ ok: true });
    expect(c.signIn.emailCode.verifyCode).toHaveBeenCalledWith({ code: '482719' });
    expect(c.signIn.finalize).toHaveBeenCalled();
  });

  it('verifies and opens the session (sign up)', async () => {
    const c = client();
    await expect(verifyEmailCode(c, 'signUp', '482719')).resolves.toEqual({ ok: true });
    expect(c.signUp.verifications.verifyEmailCode).toHaveBeenCalledWith({ code: '482719' });
    expect(c.signUp.finalize).toHaveBeenCalled();
  });

  it('reports a wrong code without opening a session', async () => {
    const c = client({ signInVerify: apiFail('form_code_incorrect') });
    await expect(verifyEmailCode(c, 'signIn', '000000')).resolves.toEqual({ ok: false, kind: 'wrong_code' });
    expect(c.signIn.finalize).not.toHaveBeenCalled();
  });

  it('refuses a code that is not 6 digits', async () => {
    const c = client();
    await expect(verifyEmailCode(c, 'signIn', '12a')).resolves.toEqual({ ok: false, kind: 'wrong_code' });
    expect(c.signIn.emailCode.verifyCode).not.toHaveBeenCalled();
  });
});

describe('authErrorKind', () => {
  it.each([
    ['verification_expired', 'expired'],
    ['too_many_requests', 'rate_limited'],
    ['something_else', 'unknown'],
  ])('maps %s to %s', (code, kind) => {
    expect(authErrorKind(Object.assign(new Error(code), { code }))).toBe(kind);
  });

  it('treats a thrown TypeError (fetch failed) as a network problem', () => {
    expect(authErrorKind(new TypeError('Network request failed'))).toBe('network');
  });
});
