import { render, screen } from '@testing-library/react-native';
import { Banner } from '../index';

describe('Banner', () => {
  it('is announced as an alert with its title and message', async () => {
    await render(
      <Banner
        tone="danger"
        title="Pas de connexion"
        message="Vérifie ton Wi-Fi ou tes données mobiles, puis réessaie."
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toBeOnTheScreen();
    expect(alert.props.accessibilityLabel).toBe(
      'Pas de connexion. Vérifie ton Wi-Fi ou tes données mobiles, puis réessaie.',
    );
  });
});
