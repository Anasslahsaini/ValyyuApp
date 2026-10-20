import AsyncStorage from '@react-native-async-storage/async-storage';
import { newLifeState } from '@workspace/domain/life';
import { initI18n } from '@workspace/i18n';
import { Slot } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { LifeProvider } from '../src/data/LifeProvider';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@clerk/expo', () => ({ useUser: () => ({ user: null }) }));
// Jest cannot run the dynamic import() the app uses to load the catalogue lazily: read the same files directly.
const mockLoad = jest.fn();
jest.mock('@workspace/domain/recipe-catalogue', () => ({
  ...jest.requireActual('@workspace/domain/recipe-catalogue'),
  loadedCatalogue: () => null,
  loadCatalogue: () => mockLoad(),
}));
const catalogue = () => {
  const built = require('@workspace/domain/data/recipes/recipes.built.json');
  return Promise.resolve({
    version: built.version,
    recipes: built.recipes,
    ingredients: require('@workspace/domain/data/recipes/ingredients.json'),
    prices: require('@workspace/domain/data/recipes/prices.json'),
  });
};

import Today from '../app/(tabs)/today/index';

const routes = {
  _layout: () => (
    <LifeProvider userId="user_t">
      <Slot />
    </LifeProvider>
  ),
  index: Today,
};

beforeAll(async () => {
  await initI18n(['fr-FR']);
});
beforeEach(async () => {
  mockLoad.mockImplementation(catalogue);
  const base = newLifeState();
  await AsyncStorage.clear();
  await AsyncStorage.setItem(
    '@app/life:user_t',
    JSON.stringify({
      ...base,
      settings: { ...base.settings, firstName: 'Rayan', onboardedAt: '2026-10-20T08:00:00.000Z' },
    }),
  );
});

describe('Aujourd’hui', () => {
  it('A1 · a new person makes the week in one tap, then sees the meal to decide', async () => {
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByText(/Bonjour Rayan/)).toBeOnTheScreen();
    expect(screen.getByText('Ta semaine de repas, en 1 touche')).toBeOnTheScreen();
    // Nothing to decide yet: no empty card full of zeros.
    expect(screen.queryByText('OK')).toBeNull();
    expect(screen.getByText('Photographier 5 vêtements')).toBeOnTheScreen();

    await fireEvent.press(await screen.findByTestId('today-make-week'));
    expect(await screen.findByText('Changer', {}, { timeout: 4000 })).toBeOnTheScreen();
    expect(screen.queryByText('Ta semaine de repas, en 1 touche')).toBeNull();
    // Without health consent, the meal card says calories are off rather than showing numbers.
    expect(screen.getByText('Calories et allergies désactivées')).toBeOnTheScreen();

    const raw = await AsyncStorage.getItem('@app/life:user_t');
    expect((JSON.parse(raw ?? '{}') as { plannedMeals?: unknown[] }).plannedMeals?.length).toBeGreaterThan(0);
  });

  it('says so and offers to retry when the recipes cannot be read', async () => {
    mockLoad.mockRejectedValueOnce(new Error('unreadable'));
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByText("Les recettes n'ont pas pu être chargées.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Réessayer'));
    expect(await screen.findByTestId('today-make-week')).toBeEnabled();
    expect(screen.queryByText("Les recettes n'ont pas pu être chargées.")).toBeNull();
  });
});
