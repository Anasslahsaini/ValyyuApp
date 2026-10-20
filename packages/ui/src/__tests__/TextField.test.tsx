import { fireEvent, render, screen } from '@testing-library/react-native';
import { TextField } from '../index';

describe('TextField', () => {
  it('shows its label as visible text, not only as a placeholder', async () => {
    await render(<TextField label="Adresse e-mail" value="" onChangeText={() => undefined} />);
    expect(screen.getByText('Adresse e-mail')).toBeVisible();
    expect(screen.getByLabelText('Adresse e-mail')).toBeOnTheScreen();
  });

  it('reports typing', async () => {
    const onChangeText = jest.fn();
    await render(<TextField label="Âge" value="" onChangeText={onChangeText} />);
    await fireEvent.changeText(screen.getByLabelText('Âge'), '25');
    expect(onChangeText).toHaveBeenCalledWith('25');
  });

  it('shows and announces an error', async () => {
    await render(
      <TextField
        label="Adresse e-mail"
        value="a@b"
        onChangeText={() => undefined}
        error="Il manque la fin de l'adresse."
      />,
    );
    expect(screen.getByText("Il manque la fin de l'adresse.")).toBeVisible();
    expect(screen.getByLabelText('Adresse e-mail').props.accessibilityHint).toBe(
      "Il manque la fin de l'adresse.",
    );
  });

  it('shows the unit as text', async () => {
    await render(<TextField label="Taille" value="170" unit="cm" onChangeText={() => undefined} />);
    expect(screen.getByText('cm')).toBeVisible();
  });
});
