import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { IconButton } from '../index';

describe('IconButton', () => {
  it('is named by its accessibility label', async () => {
    const onPress = jest.fn();
    await render(<IconButton accessibilityLabel="Ajouter un repas" onPress={onPress} icon={null} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter un repas' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('has a touch target of at least 44 × 44', async () => {
    await render(<IconButton accessibilityLabel="Profil" onPress={() => undefined} icon={null} testID="i" />);
    const style = StyleSheet.flatten(screen.getByTestId('i').props.style);
    expect(style.minWidth).toBeGreaterThanOrEqual(44);
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
  });
});
