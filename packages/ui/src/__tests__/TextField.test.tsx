import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { TextField } from '../index';

describe('TextField', () => {
  it('shows its label as visible text, not only as a placeholder', async () => {
    await render(<TextField label="Adresse e-mail" value="" onChangeText={() => undefined} />);
    expect(screen.getByText('Adresse e-mail', { includeHiddenElements: true })).toBeOnTheScreen();
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

  it('announces a new error to VoiceOver', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { rerender } = await render(<TextField label="Code" value="1" onChangeText={() => undefined} />);
    expect(announce).not.toHaveBeenCalled();
    await rerender(
      <TextField label="Code" value="1" onChangeText={() => undefined} error="Ce code ne marche pas." />,
    );
    expect(announce).toHaveBeenCalledWith('Ce code ne marche pas.');
  });

  it('is read once: the visible label is hidden from screen readers', async () => {
    await render(<TextField label="Adresse e-mail" value="" onChangeText={() => undefined} />);
    expect(screen.getAllByLabelText('Adresse e-mail')).toHaveLength(1);
    expect(screen.getByText('Adresse e-mail', { includeHiddenElements: true })).not.toBeVisible();
  });
});
