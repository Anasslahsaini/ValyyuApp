/** Pure access rules: sign-in → first-launch questions → paywall → app. */
export type Gate = 'loading' | 'signin' | 'onboarding' | 'paywall' | 'app';
export type SubscriptionStatus = 'loading' | 'active' | 'inactive';
/** `off` = this check is not configured on this build/server, or it failed. */
export type Check<T> = { state: 'pending' } | { state: 'off' } | { state: 'done'; value: T };
export type ServerAccess = { active: boolean; admin: boolean; enforced: boolean };

export function gateFor(i: {
  authConfigured: boolean;
  authLoaded: boolean;
  signedIn: boolean;
  devPass: boolean;
  subscription: SubscriptionStatus;
  /** null while the workspace is still loading. */
  onboarded: boolean | null;
}): Gate {
  // The development pass skips account and paywall, never the first-launch questions.
  if (i.devPass) return i.onboarded === null ? 'loading' : i.onboarded ? 'app' : 'onboarding';
  if (!i.authConfigured) return 'signin'; // The sign-in screen explains that this build has no key.
  if (!i.authLoaded) return 'loading';
  if (!i.signedIn) return 'signin';
  if (i.onboarded === null) return 'loading';
  // Questions before the paywall: the plan shown at the end is the reason to subscribe.
  if (!i.onboarded) return 'onboarding';
  if (i.subscription === 'loading') return 'loading';
  return i.subscription === 'active' ? 'app' : 'paywall';
}

/**
 * Store purchase (RevenueCat SDK) OR server check. The server answer only unlocks when it really
 * enforces subscriptions (a server without RevenueCat says "active" to everyone); admins always pass.
 */
export function resolveAccess(store: Check<boolean>, server: Check<ServerAccess>): SubscriptionStatus {
  const s = server.state === 'done' ? server.value : null;
  if ((store.state === 'done' && store.value) || s?.admin || (s?.active && s.enforced)) return 'active';
  if (store.state === 'pending' || server.state === 'pending') return 'loading';
  return 'inactive';
}
