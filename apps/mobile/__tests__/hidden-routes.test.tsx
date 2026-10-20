import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

jest.mock('../src/env', () => ({ isDevBuild: jest.fn(() => true) }));
jest.mock('@workspace/config', () => ({
  ...jest.requireActual('@workspace/config'),
  features: { community: false },
}));

import { isDevBuild } from '../src/env';
import CommunityLayout from '../app/(community)/_layout';
import DevLayout from '../app/dev/_layout';

const routes = {
  index: () => <Text>home</Text>,
  '(community)/_layout': CommunityLayout,
  '(community)/community': () => <Text>community</Text>,
  'dev/_layout': DevLayout,
  'dev/catalog': () => <Text>catalog</Text>,
};

describe('hidden routes', () => {
  it('sends a deep link to /community back home while the flag is off', async () => {
    await renderRouter(routes, { initialUrl: '/community' });
    expect(screen.getByText('home')).toBeOnTheScreen();
    expect(screen.queryByText('community')).toBeNull();
  });

  it('opens the catalog in development builds', async () => {
    await renderRouter(routes, { initialUrl: '/dev/catalog' });
    expect(screen.getByText('catalog')).toBeOnTheScreen();
  });

  it('sends /dev/catalog back home outside development builds', async () => {
    jest.mocked(isDevBuild).mockReturnValue(false);
    await renderRouter(routes, { initialUrl: '/dev/catalog' });
    expect(screen.getByText('home')).toBeOnTheScreen();
    expect(screen.queryByText('catalog')).toBeNull();
  });
});
