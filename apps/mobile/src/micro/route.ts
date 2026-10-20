import type { Navigation } from '@workspace/domain/voice/execute';

/** The command engine speaks the first app's routes; this maps them onto the new tabs. */
export function appRoute(nav: Navigation): { pathname: string; params?: Record<string, string> } {
  const action = nav.params?.action;
  switch (nav.pathname) {
    case '/meals':
      return { pathname: '/repas' };
    case '/fitness':
      return action === 'startToday' ? { pathname: '/sport/session' } : { pathname: '/sport' };
    case '/style':
      return { pathname: '/style' };
    case '/profile':
      return { pathname: '/profile' };
    default:
      return { pathname: '/today' };
  }
}
