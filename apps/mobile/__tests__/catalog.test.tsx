import { initI18n } from '@workspace/i18n';
import { color, CONTRAST_PAIRS, contrastRatio, radius, space, type } from '@workspace/tokens';
import { render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import Catalog from '../app/dev/catalog';
import { flattenColors, formatRatio } from '../src/catalog/format';

beforeAll(async () => {
  await initI18n(['fr-FR']);
});

describe('formatRatio', () => {
  it('formats a contrast ratio the French way', () => {
    expect(formatRatio(16.04)).toBe('16,0:1');
    expect(formatRatio(5.83)).toBe('5,8:1');
  });
});

describe('design catalog', () => {
  it('shows every color token with its name and value', async () => {
    await render(<Catalog />);
    for (const [name, hex] of flattenColors(color)) {
      expect(screen.getByText(name)).toBeOnTheScreen();
      expect(screen.getAllByText(hex).length).toBeGreaterThan(0);
    }
    expect(screen.getByText('color.bg.paper')).toBeOnTheScreen();
  });

  it('shows the ratio of every allowed contrast pair', async () => {
    await render(<Catalog />);
    for (const pair of CONTRAST_PAIRS) {
      const row = screen.getByTestId(`pair-${pair.usage}`);
      expect(within(row).getByText(formatRatio(contrastRatio(pair.fg, pair.bg)))).toBeOnTheScreen();
    }
  });

  it('shows every type, space and radius token', async () => {
    await render(<Catalog />);
    for (const name of Object.keys(type)) expect(screen.getByTestId(`type-${name}`)).toBeOnTheScreen();
    for (const name of Object.keys(space)) expect(screen.getByText(`space.${name}`)).toBeOnTheScreen();
    for (const name of Object.keys(radius)) expect(screen.getByText(`radius.${name}`)).toBeOnTheScreen();
  });

  it('shows every button kind in normal, disabled and loading states', async () => {
    await render(<Catalog />);
    for (const kind of ['primary', 'secondary', 'tertiary', 'decision', 'destructive']) {
      expect(screen.getByTestId(`button-${kind}-normal`)).toBeOnTheScreen();
      expect(screen.getByTestId(`button-${kind}-disabled`)).toBeDisabled();
      expect(screen.getByTestId(`button-${kind}-loading`)).toBeBusy();
    }
  });

  it('paints the primary button with the ink token', async () => {
    await render(<Catalog />);
    expect(StyleSheet.flatten(screen.getByTestId('button-primary-normal').props.style).backgroundColor).toBe(
      color.ink.primary,
    );
  });
});
