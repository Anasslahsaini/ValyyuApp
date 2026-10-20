import { fireEvent, render, screen } from '@testing-library/react-native';
import { CodeInput } from '../index';

describe('CodeInput', () => {
  it('is one field named by its label, with iOS one-time-code autofill', async () => {
    await render(<CodeInput label="Code à 6 chiffres" value="" onChangeText={() => undefined} />);
    const input = screen.getByLabelText('Code à 6 chiffres');
    expect(input.props.textContentType).toBe('oneTimeCode');
    expect(input.props.autoComplete).toBe('one-time-code');
    expect(input.props.keyboardType).toBe('number-pad');
    expect(input.props.maxLength).toBe(6);
  });

  it('keeps digits only, at most 6', async () => {
    const onChangeText = jest.fn();
    await render(<CodeInput label="Code" value="" onChangeText={onChangeText} />);
    await fireEvent.changeText(screen.getByLabelText('Code'), '48 2-71a99');
    expect(onChangeText).toHaveBeenCalledWith('482719');
  });

  it('shows each typed digit in its own box', async () => {
    await render(<CodeInput label="Code" value="482" onChangeText={() => undefined} />);
    for (const digit of ['4', '8', '2'])
      expect(screen.getByText(digit, { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getAllByTestId('code-box', { includeHiddenElements: true })).toHaveLength(6);
  });

  it('announces the error through the field', async () => {
    await render(
      <CodeInput label="Code" value="" onChangeText={() => undefined} error="Ce code ne marche pas." />,
    );
    expect(screen.getByLabelText('Code').props.accessibilityHint).toBe('Ce code ne marche pas.');
    expect(screen.getByText('Ce code ne marche pas.')).toBeVisible();
  });
});
