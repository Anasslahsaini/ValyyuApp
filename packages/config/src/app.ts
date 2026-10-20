/** The only place the app's name and store identifiers are written. Change them here, nowhere else. */
export const app = {
  /** Display name, always lowercase (see the logo guidelines). */
  name: 'valyyu',
  slug: 'valyyu',
  scheme: 'valyyu',
  iosBundleId: 'com.valyyu.app',
  androidPackage: 'com.valyyu.app',
  /** What people say to address the app by voice (spoken variants of the name). */
  wakeWords: ['valyyu', 'valyu', 'valiou', 'valu', 'vayylo'],
  legal: {
    termsUrl: null as string | null,
    privacyUrl: null as string | null,
  },
} as const;
