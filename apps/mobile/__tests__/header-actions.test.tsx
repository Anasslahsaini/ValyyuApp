import { initI18n } from '@workspace/i18n';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { TodayHeaderActions } from '../src/navigation/TodayHeaderActions';

beforeAll(async () => {
  await initI18n(['fr-FR']);
});

describe('Today header actions', () => {
  it('opens the profile', async () => {
    const onProfile = jest.fn();
    await render(
      <TodayHeaderActions community={false} onProfile={onProfile} onCommunity={() => undefined} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Profil et réglages' }));
    expect(onProfile).toHaveBeenCalledTimes(1);
  });

  it('hides the community button while the flag is off', async () => {
    await render(
      <TodayHeaderActions community={false} onProfile={() => undefined} onCommunity={() => undefined} />,
    );
    expect(screen.queryByRole('button', { name: 'Communauté' })).toBeNull();
  });

  it('shows the community button when the flag is on', async () => {
    await render(<TodayHeaderActions community onProfile={() => undefined} onCommunity={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Communauté' })).toBeOnTheScreen();
  });
});
