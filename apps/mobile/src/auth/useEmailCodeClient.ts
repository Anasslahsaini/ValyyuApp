import { useSignIn, useSignUp } from '@clerk/expo';
import type { EmailCodeClient } from './email-code';

/** The Clerk sign-in and sign-up signals, shaped for email-code.ts. */
export function useEmailCodeClient(): EmailCodeClient {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  return { signIn, signUp };
}
