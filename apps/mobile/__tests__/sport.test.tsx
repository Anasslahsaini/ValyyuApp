import AsyncStorage from '@react-native-async-storage/async-storage';
import { newLifeState, type LifeState } from '@workspace/domain/life';
import { initI18n } from '@workspace/i18n';
import { Slot } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { LifeProvider } from '../src/data/LifeProvider';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import SportLayout from '../app/(tabs)/sport/_layout';
import Done from '../app/(tabs)/sport/done';
import Sport from '../app/(tabs)/sport/index';
import SessionScreen from '../app/(tabs)/sport/session';

const routes = {
  _layout: () => (
    <LifeProvider userId="user_s">
      <Slot />
    </LifeProvider>
  ),
  'sport/_layout': SportLayout,
  'sport/index': Sport,
  'sport/session': SessionScreen,
  'sport/done': Done,
};
const KEY = '@app/life:user_s';
const stored = async () => JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}') as LifeState;

beforeAll(async () => {
  await initI18n(['fr-FR']);
});
beforeEach(async () => {
  await AsyncStorage.clear();
  const s = newLifeState();
  s.settings.onboardedAt = '2026-10-20T08:00:00.000Z';
  s.settings.trainingPlace = 'home';
  s.settings.sessionsPerWeek = 3;
  s.settings.equipment = ['bodyweight'];
  await AsyncStorage.setItem(KEY, JSON.stringify(s));
});

describe('Sport', () => {
  it('runs a session: nothing saved until a set is ticked, then only done sets are kept', async () => {
    await renderRouter(routes, { initialUrl: '/sport' });
    expect(await screen.findByText('0 / 3 séances')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('sport-start'));

    await fireEvent.press(await screen.findByTestId('sport-finish'));
    expect(screen.getByText(/Coche au moins une série/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('set-0-0'));
    expect(await screen.findByText(/Repos : /)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('sport-finish'));

    expect(await screen.findByText('Séance terminée !')).toBeOnTheScreen();
    const sessions = (await stored()).sessions;
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.exercises).toHaveLength(1);
    expect(sessions[0]?.exercises[0]?.sets).toHaveLength(1);
    // No calorie estimate without health consent.
    expect(screen.queryByText(/kcal dépensées/)).toBeNull();
  });
});
