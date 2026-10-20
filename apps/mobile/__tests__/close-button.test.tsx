import { initI18n } from '@workspace/i18n';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { CloseButton } from '../src/navigation/CloseButton';

beforeAll(async () => {
  await initI18n(['fr-FR']);
});

it('offers a visible, named Close button for modals', async () => {
  const onPress = jest.fn();
  await render(<CloseButton onPress={onPress} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});
