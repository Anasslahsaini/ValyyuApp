/** True in development builds (Expo Go, dev clients); false in store builds. */
export function isDevBuild(): boolean {
  return __DEV__;
}
