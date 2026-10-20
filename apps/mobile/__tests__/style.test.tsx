import AsyncStorage from '@react-native-async-storage/async-storage';
import { newLifeState, type LifeState } from '@workspace/domain/life';
import { initI18n } from '@workspace/i18n';
import { Slot } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { LifeProvider } from '../src/data/LifeProvider';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../src/style/photos', () => ({
  pickPhoto: jest.fn(() => Promise.resolve({ denied: true })),
  keepPhoto: jest.fn((uri: string) => Promise.resolve(uri)),
  dropPhoto: jest.fn(),
}));

import StyleLayout from '../app/(tabs)/style/_layout';
import StyleScreen from '../app/(tabs)/style/index';
import Piece from '../app/(tabs)/style/piece';

const routes = {
  _layout: () => (
    <LifeProvider userId="user_y">
      <Slot />
    </LifeProvider>
  ),
  'style/_layout': StyleLayout,
  'style/index': StyleScreen,
  'style/piece': Piece,
};
const KEY = '@app/life:user_y';
const stored = async () => JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}') as LifeState;
const eventually = async (check: (s: LifeState) => boolean) => {
  for (let i = 0; i < 100; i++) {
    if (check(await stored())) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('storage never matched');
};
const seed = async (edit: (s: LifeState) => void) => {
  const s = newLifeState();
  s.settings.onboardedAt = '2026-10-20T08:00:00.000Z';
  edit(s);
  await AsyncStorage.setItem(KEY, JSON.stringify(s));
};

beforeAll(async () => {
  await initI18n(['fr-FR']);
});
beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('Style', () => {
  it('adds a piece with its color; a refused photo access offers the Settings', async () => {
    await seed(() => undefined);
    await renderRouter(routes, { initialUrl: '/style' });
    await fireEvent.press(await screen.findByTestId('style-empty-add'));
    await fireEvent.press(await screen.findByText('Prendre une photo'));
    expect(await screen.findByText('Ouvrir les Réglages')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('piece-name'), 'Jean brut');
    await fireEvent.press(screen.getByRole('radio', { name: 'Bas' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Jean' }));
    await fireEvent.press(screen.getByTestId('form-save'));
    await eventually((s) => s.wardrobe.length === 1);
    expect((await stored()).wardrobe[0]).toMatchObject({
      name: 'Jean brut',
      category: 'bottom',
      color: 'denim',
    });
  });

  it("suggests today's outfit, swaps a piece and wears it", async () => {
    await seed((s) => {
      s.wardrobe.push(
        { id: 't1', name: 'T-shirt blanc', category: 'top', color: 'white' },
        { id: 't2', name: 'Chemise bleue', category: 'top', color: 'blue' },
        { id: 'b1', name: 'Jean', category: 'bottom', color: 'denim' },
        { id: 's1', name: 'Baskets', category: 'shoes', color: 'white' },
      );
    });
    await renderRouter(routes, { initialUrl: '/style' });
    const top = await screen.findByRole('button', { name: /^Changer Haut : / });
    const before = top.props.accessibilityLabel as string;
    await fireEvent.press(top);
    const after = (await screen.findByRole('button', { name: /^Changer Haut : / })).props
      .accessibilityLabel as string;
    expect(after).not.toBe(before);
    await fireEvent.press(screen.getByTestId('style-wear'));
    await eventually((s) => s.outfits.length === 1);
    const s = await stored();
    expect(s.outfits[0]?.wornOn).toHaveLength(1);
    expect(s.wardrobe.filter((w) => w.wearCount === 1).length).toBeGreaterThanOrEqual(3);
  });
});
