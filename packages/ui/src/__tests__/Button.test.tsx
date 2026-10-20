import { color, size } from '@workspace/tokens';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Button } from '../index';

describe('Button', () => {
  it('exposes a button role named by its label and calls onPress once', async () => {
    const onPress = jest.fn();
    await render(<Button label="Continuer" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['disabled', { disabled: true }],
    ['loading', { loading: true }],
  ] as const)('ignores presses when %s and announces it', async (_state, props) => {
    const onPress = jest.fn();
    await render(<Button label="Continuer" onPress={onPress} {...props} />);
    const button = screen.getByRole('button', { name: 'Continuer' });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
  });

  it('announces loading as busy', async () => {
    await render(<Button label="Continuer" onPress={() => undefined} loading />);
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeBusy();
  });

  it('uses lime for the decision kind', async () => {
    await render(<Button label="OK" onPress={() => undefined} kind="decision" testID="b" />);
    expect(StyleSheet.flatten(screen.getByTestId('b').props.style)).toMatchObject({
      backgroundColor: color.accent.lime,
    });
  });

  it('grows with large text instead of truncating (font scale 3.1)', async () => {
    const label = 'Continuer avec un e-mail et recevoir un code à six chiffres pour se connecter vite';
    await render(<Button label={label} onPress={() => undefined} testID="b" />);
    const style = StyleSheet.flatten(screen.getByTestId('b').props.style);
    expect(style.height).toBeUndefined();
    expect(style.minHeight).toBe(size.buttonHeight);
    expect(screen.getByText(label).props.numberOfLines).toBeUndefined();
    expect(screen.getByText(label).props.allowFontScaling).not.toBe(false);
  });
});
