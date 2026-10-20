/** Clerk publishable key (public by design). Set in apps/mobile/.env, see .env.example. */
const raw: unknown = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
export const CLERK_PUBLISHABLE_KEY = typeof raw === 'string' ? raw : '';
