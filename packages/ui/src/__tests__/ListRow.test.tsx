import { color } from '@workspace/tokens';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ListRow } from '../index';
import { setupI18n } from '../test-utils/setup-i18n';

beforeAll(setupI18n);

describe('ListRow', () => {
  it('is a button at least 52 high when pressable', async () => {
    await render(<ListRow title="Compte" value="rayan@exemple.fr" onPress={() => undefined} testID="r" />);
    expect(screen.getByRole('button', { name: /Compte/ })).toBeOnTheScreen();
    expect(StyleSheet.flatten(screen.getByTestId('r').props.style).minHeight).toBeGreaterThanOrEqual(52);
  });

  it('is not a button without onPress', async () => {
    await render(<ListRow title="Version" value="1.0" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('uses the danger color when destructive', async () => {
    await render(<ListRow title="Supprimer mon compte" onPress={() => undefined} destructive />);
    expect(StyleSheet.flatten(screen.getByText('Supprimer mon compte').props.style).color).toBe(
      color.danger.fg,
    );
  });

  it('tells screen readers when it opens another app', async () => {
    await render(<ListRow title="Langue" value="Français" onPress={() => undefined} external />);
    expect(screen.getByRole('button', { name: /Langue/ }).props.accessibilityHint).toBe(
      'Ouvre les Réglages du téléphone',
    );
  });
});
