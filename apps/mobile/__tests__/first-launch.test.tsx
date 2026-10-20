import AsyncStorage from '@react-native-async-storage/async-storage';
import { initI18n } from '@workspace/i18n';
import { Slot } from 'expo-router';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { LifeProvider } from '../src/data/LifeProvider';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
const mockSignOut = jest.fn();
jest.mock('@clerk/expo', () => ({
  useUser: () => ({ user: null }),
  useClerk: () => ({ signOut: mockSignOut }),
}));

import OnboardingLayout from '../app/(onboarding)/_layout';
import Goal from '../app/(onboarding)/goal';
import Health from '../app/(onboarding)/health';
import Meals from '../app/(onboarding)/meals';
import Plan from '../app/(onboarding)/plan';
import Training from '../app/(onboarding)/training';
import Start from '../app/(onboarding)/start';
import You from '../app/(onboarding)/you';

const routes = {
  _layout: () => (
    <LifeProvider userId="user_a">
      <Slot />
    </LifeProvider>
  ),
  '(onboarding)/_layout': OnboardingLayout,
  '(onboarding)/start': Start,
  '(onboarding)/you': You,
  '(onboarding)/health': Health,
  '(onboarding)/goal': Goal,
  '(onboarding)/meals': Meals,
  '(onboarding)/training': Training,
  // The tabs exist next to the first launch: a step must never share a URL with a tab (it would open the tab).
  '(tabs)/sport/index': () => null,
  '(tabs)/repas/index': () => null,
  '(tabs)/style/index': () => null,
  '(tabs)/today/index': () => null,
  '(onboarding)/plan': Plan,
};

const saved = async () => {
  const raw = await AsyncStorage.getItem('@app/life:user_a');
  return raw ? (JSON.parse(raw) as { settings: Record<string, unknown> }) : null;
};

/** Screens slide in after a push: wait for the new one before touching it. */
const press = async (find: () => Promise<unknown>) => {
  await fireEvent.press((await find()) as never);
};
const next = () => press(() => screen.findByTestId('step-primary'));

const fillYou = async (age: string) => {
  await press(() => screen.findByTestId('onboarding-questions'));
  await fireEvent.changeText(await screen.findByTestId('onboarding-name'), 'Rayan');
  await fireEvent.changeText(screen.getByTestId('onboarding-age'), age);
};

beforeAll(async () => {
  await initI18n(['fr-FR']);
});
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('first launch', () => {
  it('stops under 15 and offers to leave without saving anything', async () => {
    await renderRouter(routes, { initialUrl: '/start' });
    await fillYou('14');
    expect(screen.getByText(/c'est à partir de 15 ans/)).toBeOnTheScreen();
    expect(screen.getByTestId('step-primary')).toBeDisabled();
    await fireEvent.press(screen.getByText('Quitter et effacer mes infos'));
    expect(mockSignOut).toHaveBeenCalled();
    expect(await saved()).toBeNull();
  });

  it('without health consent, saves the plan with no body data and no calories', async () => {
    await renderRouter(routes, { initialUrl: '/start' });
    await fillYou('25');
    await next();
    // O2: the consent box starts unchecked; going on without it is allowed.
    expect(await screen.findByRole('checkbox')).not.toBeChecked();
    await next();
    await press(() => screen.findByText('Perdre du poids'));
    expect(screen.queryByText('Pour estimer tes besoins')).toBeNull();
    await next();
    await screen.findByText('Tes repas');
    await press(() => screen.findByText('Passer'));
    await screen.findByText('Ton sport');
    await press(() => screen.findByText('Passer'));

    await waitFor(
      () => {
        expect(screen.getByText('Ton plan est prêt, Rayan')).toBeOnTheScreen();
      },
      { timeout: 4000 },
    );
    expect(screen.getByText(/Sans tes données de santé/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('plan-go'));

    await waitFor(async () => {
      expect((await saved())?.settings.onboardedAt).toBeDefined();
    });
    const settings = (await saved())?.settings ?? {};
    expect(settings.firstName).toBe('Rayan');
    expect(settings.calorieTarget ?? 0).toBe(0); // 0 = no target
    expect(settings.weightKg ?? 0).toBe(0);
    expect(settings.healthConsentAt).toBeUndefined();
  });

  it('a 16-year-old who wants to lose weight gets the keep-fit plan', async () => {
    await renderRouter(routes, { initialUrl: '/start' });
    await fillYou('16');
    await next();
    await press(() => screen.findByRole('checkbox'));
    await next();
    await press(() => screen.findByText('Perdre du poids'));
    expect(screen.getByText('On va plutôt viser la forme')).toBeOnTheScreen();
  });
});
