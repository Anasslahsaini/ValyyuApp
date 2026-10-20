import { tKey } from '@workspace/i18n';
import type { AuthErrorKind } from './email-code';

/** Translation key for each auth error the screens show. */
export const AUTH_ERROR_KEY: Record<AuthErrorKind, string> = {
  invalid_email: tKey('auth.errors.invalidEmail'),
  wrong_code: tKey('auth.errors.wrongCode'),
  expired: tKey('auth.errors.expired'),
  network: tKey('auth.errors.network'),
  linked_google: tKey('auth.errors.linkedGoogle'),
  rate_limited: tKey('auth.errors.rateLimited'),
  unknown: tKey('auth.errors.unknown'),
};
