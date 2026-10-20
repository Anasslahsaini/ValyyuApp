import AsyncStorage from '@react-native-async-storage/async-storage';
import { newLifeState, type LifeState } from '@workspace/domain/life';
import { initI18n } from '@workspace/i18n';
import { Slot } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Alert } from 'react-native';
import { LifeProvider } from '../src/data/LifeProvider';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@clerk/expo', () => ({
  useUser: () => ({ user: { primaryEmailAddress: { emailAddress: 'rayan@exemple.fr' } } }),
  useClerk: () => ({ signOut: jest.fn() }),
}));

import Micro from '../app/(tabs)/micro/index';
import Health from '../app/profile/health';

const KEY = '@app/life:user_m';
const stored = async () => JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}') as LifeState;
const eventually = async (check: (s: LifeState) => boolean) => {
  for (let i = 0; i < 100; i++) {
    if (check(await stored())) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('storage never matched');
};
const layout = () => (
  <LifeProvider userId="user_m">
    <Slot />
  </LifeProvider>
);

beforeAll(async () => {
  await initI18n(['fr-FR']);
});
beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('Micro (typed)', () => {
  it('adds groceries from a sentence and undoes it', async () => {
    const s = newLifeState();
    s.settings.onboardedAt = '2026-10-20T08:00:00.000Z';
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
    await renderRouter({ _layout: layout, index: Micro }, { initialUrl: '/' });
    await fireEvent.changeText(await screen.findByTestId('micro-input'), 'ajoute du lait aux courses');
    await fireEvent.press(screen.getByTestId('micro-send'));
    await eventually((x) => x.groceries.length === 1);
    expect((await stored()).groceries[0]?.name.toLowerCase()).toContain('lait');
    await fireEvent.press(await screen.findByTestId('micro-undo'));
    await eventually((x) => x.groceries.length === 0);
  });
});

describe('Profil · données de santé', () => {
  it('withdrawing consent erases body data and the weight history', async () => {
    const s = newLifeState();
    s.settings.onboardedAt = '2026-10-20T08:00:00.000Z';
    s.settings.healthConsentAt = '2026-10-01T08:00:00.000Z';
    s.settings.heightCm = 180;
    s.settings.calorieTarget = 2400;
    s.weightEntries.push({ id: 'w1', date: '2026-10-01', weight: 80 });
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    await renderRouter({ _layout: layout, index: Health }, { initialUrl: '/' });
    await fireEvent.press(await screen.findByTestId('health-withdraw'));
    await eventually((x) => !x.settings.healthConsentAt);
    const after = await stored();
    expect(after.settings.heightCm).toBeUndefined();
    expect(after.settings.calorieTarget).toBe(0);
    expect(after.weightEntries).toHaveLength(0);
    // Giving it again needs the box ticked (never pre-ticked).
    expect(await screen.findByTestId('health-give')).toBeDisabled();
  });
});
