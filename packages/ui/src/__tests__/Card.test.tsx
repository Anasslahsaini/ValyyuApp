import { elevation } from '@workspace/tokens';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Card, Text } from '../index';

describe('Card', () => {
  it('uses elevation 1 when elevated', async () => {
    await render(
      <Card elevated testID="c">
        <Text>Contenu</Text>
      </Card>,
    );
    expect(StyleSheet.flatten(screen.getByTestId('c').props.style)).toMatchObject({
      shadowOpacity: elevation[1].shadowOpacity,
    });
  });

  it('is flat with a hairline border by default', async () => {
    await render(
      <Card testID="c">
        <Text>Contenu</Text>
      </Card>,
    );
    const style = StyleSheet.flatten(screen.getByTestId('c').props.style);
    expect(style.shadowOpacity ?? 0).toBe(0);
    expect(style.borderWidth).toBeGreaterThan(0);
  });
});
