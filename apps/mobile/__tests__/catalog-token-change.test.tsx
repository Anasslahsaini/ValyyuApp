import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

// One token change must show everywhere: swap ink and render the catalog.
jest.mock('@workspace/tokens', () => {
  const actual = jest.requireActual('@workspace/tokens');
  return { ...actual, color: { ...actual.color, ink: { ...actual.color.ink, primary: '#123456' } } };
});

import { initI18n } from '@workspace/i18n';
import Catalog from '../app/dev/catalog';

beforeAll(async () => {
  await initI18n(['fr-FR']);
});

it('repaints the primary button when color.ink.primary changes', async () => {
  await render(<Catalog />);
  expect(StyleSheet.flatten(screen.getByTestId('button-primary-normal').props.style).backgroundColor).toBe(
    '#123456',
  );
});
