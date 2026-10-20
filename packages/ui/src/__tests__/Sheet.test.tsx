import { fireEvent, render, screen } from '@testing-library/react-native';
import { Sheet, Text } from '../index';
import { setupI18n } from '../test-utils/setup-i18n';

beforeAll(setupI18n);

describe('Sheet', () => {
  it('shows its title and a visible close button', async () => {
    const onClose = jest.fn();
    await render(
      <Sheet visible onClose={onClose} title="Réglages des repas">
        <Text>Contenu</Text>
      </Sheet>,
    );
    expect(screen.getByText('Réglages des repas')).toBeVisible();
    await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when hidden', async () => {
    await render(
      <Sheet visible={false} onClose={() => undefined} title="Réglages des repas">
        <Text>Contenu</Text>
      </Sheet>,
    );
    expect(screen.queryByText('Réglages des repas')).toBeNull();
  });
});
