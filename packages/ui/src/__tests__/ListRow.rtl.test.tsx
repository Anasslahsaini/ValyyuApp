import { render, screen } from '@testing-library/react-native';
import { I18nManager, StyleSheet } from 'react-native';
import { ListRow } from '../index';
import { setupI18n } from '../test-utils/setup-i18n';

beforeAll(setupI18n);

it('points the chevron toward the end in Arabic (left)', async () => {
  jest.replaceProperty(I18nManager, 'isRTL', true);
  await render(<ListRow title="Compte" onPress={() => undefined} />);
  expect(
    StyleSheet.flatten(screen.getByTestId('chevron', { includeHiddenElements: true }).props.style).transform,
  ).toEqual([{ rotate: '-45deg' }]);
});

it('points the chevron toward the end in French (right)', async () => {
  jest.replaceProperty(I18nManager, 'isRTL', false);
  await render(<ListRow title="Compte" onPress={() => undefined} />);
  expect(
    StyleSheet.flatten(screen.getByTestId('chevron', { includeHiddenElements: true }).props.style).transform,
  ).toEqual([{ rotate: '45deg' }]);
});
