import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SegmentedControl } from '../index';

const options = [
  { value: 'semaine', label: 'Semaine' },
  { value: 'frigo', label: 'Frigo' },
  { value: 'courses', label: 'Courses' },
] as const;

describe('SegmentedControl', () => {
  it('marks the chosen option as selected', async () => {
    await render(
      <SegmentedControl
        options={options}
        value="frigo"
        onChange={() => undefined}
        accessibilityLabel="Vue des repas"
      />,
    );
    expect(screen.getByRole('tab', { name: 'Frigo' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Semaine' })).not.toBeSelected();
  });

  it('reports the new value', async () => {
    const onChange = jest.fn();
    await render(
      <SegmentedControl
        options={options}
        value="semaine"
        onChange={onChange}
        accessibilityLabel="Vue des repas"
      />,
    );
    await fireEvent.press(screen.getByRole('tab', { name: 'Courses' }));
    expect(onChange).toHaveBeenCalledWith('courses');
  });

  it.each([1, 5])('refuses %i options', async (n) => {
    const many = Array.from({ length: n }, (_, i) => ({
      value: `v${String(i)}`,
      label: `Option ${String(i)}`,
    }));
    await expect(
      render(
        <SegmentedControl options={many} value="v0" onChange={() => undefined} accessibilityLabel="x" />,
      ),
    ).rejects.toThrow(/2 to 4/);
  });

  it('gives every segment a 44 pt touch target', async () => {
    await render(
      <SegmentedControl
        options={options}
        value="frigo"
        onChange={() => undefined}
        accessibilityLabel="Vue des repas"
      />,
    );
    for (const tab of screen.getAllByRole('tab'))
      expect(StyleSheet.flatten(tab.props.style).minHeight).toBeGreaterThanOrEqual(44);
  });
});
