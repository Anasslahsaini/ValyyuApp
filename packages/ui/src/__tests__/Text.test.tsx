import { fontFamily } from '@workspace/tokens';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Text } from '../index';

describe('Text', () => {
  it('uses tabular figures for numbers', async () => {
    await render(<Text numeric>1 950</Text>);
    expect(StyleSheet.flatten(screen.getByText('1 950').props.style).fontVariant).toContain('tabular-nums');
  });

  it('uses the display family for large titles', async () => {
    await render(<Text variant="largeTitle">Bonjour</Text>);
    expect(StyleSheet.flatten(screen.getByText('Bonjour').props.style).fontFamily).toBe(fontFamily.display);
  });

  it('always allows font scaling', async () => {
    await render(<Text>Texte</Text>);
    expect(screen.getByText('Texte').props.allowFontScaling).not.toBe(false);
  });
});
