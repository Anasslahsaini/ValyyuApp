import AsyncStorage from '@react-native-async-storage/async-storage';
import { newLifeState, type LifeState } from '@workspace/domain/life';
import { initI18n } from '@workspace/i18n';
import { Slot } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { LifeProvider } from '../src/data/LifeProvider';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
// Jest cannot run the catalogue's lazy import(): read the same files directly.
jest.mock('@workspace/domain/recipe-catalogue', () => {
  const built = require('@workspace/domain/data/recipes/recipes.built.json');
  const data = {
    version: built.version,
    recipes: built.recipes,
    ingredients: require('@workspace/domain/data/recipes/ingredients.json'),
    prices: require('@workspace/domain/data/recipes/prices.json'),
  };
  return {
    ...jest.requireActual('@workspace/domain/recipe-catalogue'),
    loadedCatalogue: () => data,
    loadCatalogue: () => Promise.resolve(data),
  };
});

import RepasLayout from '../app/(tabs)/repas/_layout';
import Grocery from '../app/(tabs)/repas/grocery';
import Repas from '../app/(tabs)/repas/index';
import Meal from '../app/(tabs)/repas/meal';
import Pantry from '../app/(tabs)/repas/pantry';
import Recipe from '../app/(tabs)/repas/recipe';

const routes = {
  _layout: () => (
    <LifeProvider userId="user_r">
      <Slot />
    </LifeProvider>
  ),
  'repas/_layout': RepasLayout,
  'repas/index': Repas,
  'repas/meal': Meal,
  'repas/pantry': Pantry,
  'repas/grocery': Grocery,
  'repas/recipe': Recipe,
};
const KEY = '@app/life:user_r';
const stored = async () => JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}') as LifeState;
const seed = async (edit: (s: LifeState) => void) => {
  const s = newLifeState();
  s.settings.onboardedAt = '2026-10-20T08:00:00.000Z';
  edit(s);
  await AsyncStorage.setItem(KEY, JSON.stringify(s));
};

/** Waits for the save to reach storage without wrapping storage reads in act(). */
const eventually = async (check: (s: LifeState) => boolean) => {
  for (let i = 0; i < 100; i++) {
    if (check(await stored())) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('storage never matched');
};

beforeAll(async () => {
  await initI18n(['fr-FR']);
});
beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('Repas', () => {
  it('logs a meal typed by hand, with no calories field without consent', async () => {
    await seed(() => undefined);
    await renderRouter(routes, { initialUrl: '/repas' });
    await fireEvent.press(await screen.findByText('Ajouter au midi'));
    expect(await screen.findByText(/Calories désactivées/)).toBeOnTheScreen();
    expect(screen.queryByTestId('meal-kcal')).toBeNull();
    await fireEvent.press(screen.getByTestId('form-save'));
    expect(screen.getByText('Écris un nom.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('meal-name'), 'Salade de pâtes');
    await fireEvent.press(screen.getByTestId('form-save'));
    expect(await screen.findByText('Salade de pâtes')).toBeOnTheScreen();
    const meals = (await stored()).meals;
    expect(meals).toHaveLength(1);
    expect(meals[0]).toMatchObject({ name: 'Salade de pâtes', slot: 'lunch', calories: 0, estimated: true });
  });

  it('suggests a meal from the fridge and cooking it takes the eggs out', async () => {
    await seed((s) => {
      s.pantry.push({ id: 'p1', name: 'œufs', quantity: '' }, { id: 'p2', name: 'tomate', quantity: '' });
    });
    await renderRouter(routes, { initialUrl: '/repas?tab=fridge' });
    expect(await screen.findByText("Qu'est-ce que je mange ?")).toBeOnTheScreen();
    const ideas = await screen.findAllByText(/Il manque|Tout est là/);
    await fireEvent.press(ideas[0] as never);
    await fireEvent.press(await screen.findByTestId('recipe-done'));
    await eventually((s) => s.meals.length === 1);
  });

  it('ticks a grocery line and moves the whole list to the fridge', async () => {
    await seed((s) => {
      s.groceries.push(
        { id: 'g1', name: 'Riz', quantity: '1 kg', estimatedCost: 2.5, checked: false },
        { id: 'g2', name: 'Tomates', quantity: '500 g', estimatedCost: 1.8, checked: false },
      );
    });
    await renderRouter(routes, { initialUrl: '/repas?tab=groceries' });
    await fireEvent.press(await screen.findByTestId('grocery-g1'));
    await eventually((s) => s.groceries.find((g) => g.id === 'g1')?.checked === true);
    expect(await screen.findByRole('checkbox', { name: 'Riz, 1 kg', checked: true })).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('repas-all-bought'));
    expect(await screen.findByText('2 articles rangés dans le frigo.')).toBeOnTheScreen();
    const after = await stored();
    expect(after.groceries).toHaveLength(0);
    expect(after.pantry.map((p) => p.name).sort()).toEqual(['Riz', 'Tomates']);
  });
});
