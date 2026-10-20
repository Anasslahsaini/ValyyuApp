import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { CheckboxRow, Chip, ChoiceRow, StepProgress } from '../index';

describe('ChoiceRow', () => {
  it('is a radio with its selected state, 44 pt or more', async () => {
    const onPress = jest.fn();
    await render(<ChoiceRow label="Garder la forme" selected onPress={onPress} testID="c" />);
    const radio = screen.getByRole('radio', { name: 'Garder la forme' });
    expect(radio).toBeChecked();
    expect(StyleSheet.flatten(screen.getByTestId('c').props.style).minHeight).toBeGreaterThanOrEqual(44);
    await fireEvent.press(radio);
    expect(onPress).toHaveBeenCalled();
  });
});

describe('Chip', () => {
  it('is a checkbox-like toggle that is not shown by color alone', async () => {
    await render(<Chip label="Lait" selected onPress={() => undefined} />);
    const chip = screen.getByRole('checkbox', { name: 'Lait' });
    expect(chip).toBeChecked();
    expect(screen.getByTestId('chip-check', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});

describe('CheckboxRow', () => {
  it('starts unchecked and toggles', async () => {
    const onChange = jest.fn();
    await render(<CheckboxRow label="J'accepte" checked={false} onChange={onChange} />);
    const box = screen.getByRole('checkbox', { name: "J'accepte" });
    expect(box).not.toBeChecked();
    await fireEvent.press(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('StepProgress', () => {
  it('reads "Étape 2 sur 5" and shows 5 segments', async () => {
    await render(<StepProgress label="Étape 2 sur 5" step={2} total={5} />);
    expect(screen.getByText('Étape 2 sur 5')).toBeOnTheScreen();
    expect(screen.getByRole('progressbar')).toHaveAccessibilityValue({ min: 0, max: 5, now: 2 });
    expect(screen.getAllByTestId('step-segment', { includeHiddenElements: true })).toHaveLength(5);
  });
});
