/**
 * App settings the creators change from the admin page (the server's public config route), with the build's
 * EXPO_PUBLIC_* values as fallback. Pure merge here; loading lives in hooks/AppConfigContext.
 */
export type AppConfig = {
  revenueCatIosKey: string;
  revenueCatAndroidKey: string;
  entitlement: string;
  privacyUrl: string;
  termsUrl: string;
  phoneSignIn: boolean;
  notice: string;
};

const APPLE_EULA = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

export const buildConfig: AppConfig = {
  revenueCatIosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY?.trim() || '',
  revenueCatAndroidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY?.trim() || '',
  entitlement: process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT?.trim() || 'plus',
  privacyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL?.trim() || '',
  termsUrl: process.env.EXPO_PUBLIC_TERMS_URL?.trim() || APPLE_EULA,
  phoneSignIn: process.env.EXPO_PUBLIC_AUTH_PHONE === 'true',
  notice: '',
};

/** Server values win when set; empty server values keep the build's value. */
export function mergeConfig(base: AppConfig, remote: Partial<AppConfig> | null | undefined): AppConfig {
  if (!remote) return base;
  const text = (k: keyof AppConfig) =>
    typeof remote[k] === 'string' && (remote[k] as string).trim()
      ? (remote[k] as string).trim()
      : (base[k] as string);
  return {
    revenueCatIosKey: text('revenueCatIosKey'),
    revenueCatAndroidKey: text('revenueCatAndroidKey'),
    entitlement: text('entitlement'),
    privacyUrl: text('privacyUrl'),
    termsUrl: text('termsUrl'),
    phoneSignIn:
      typeof remote.phoneSignIn === 'boolean' ? remote.phoneSignIn || base.phoneSignIn : base.phoneSignIn,
    notice: typeof remote.notice === 'string' ? remote.notice.trim().slice(0, 300) : '',
  };
}
