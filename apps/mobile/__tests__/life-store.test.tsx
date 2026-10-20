import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { LifeProvider, useLife } from '../src/data/LifeProvider';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const wrapper = (userId: string) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <LifeProvider userId={userId}>{children}</LifeProvider>;
  };

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('LifeProvider', () => {
  it('starts empty for a new account', async () => {
    const { result } = await renderHook(() => useLife(), { wrapper: wrapper('user_a') });
    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });
    expect(result.current.state.settings.onboardedAt).toBeUndefined();
  });

  it('saves settings on the phone, per account', async () => {
    const a = await renderHook(() => useLife(), { wrapper: wrapper('user_a') });
    await waitFor(() => {
      expect(a.result.current.ready).toBe(true);
    });
    await act(async () => {
      await a.result.current.updateSettings({ firstName: 'Rayan' });
    });
    expect(a.result.current.state.settings.firstName).toBe('Rayan');

    const again = await renderHook(() => useLife(), { wrapper: wrapper('user_a') });
    await waitFor(() => {
      expect(again.result.current.state.settings.firstName).toBe('Rayan');
    });
    const b = await renderHook(() => useLife(), { wrapper: wrapper('user_b') });
    await waitFor(() => {
      expect(b.result.current.ready).toBe(true);
    });
    expect(b.result.current.state.settings.firstName).toBeUndefined();
  });

  it('keeps going with an empty state when stored data is unreadable', async () => {
    await AsyncStorage.setItem('@app/life:user_c', '{not json');
    const { result } = await renderHook(() => useLife(), { wrapper: wrapper('user_c') });
    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });
    expect(result.current.state.version).toBe(1);
  });

  it('erases everything for the account', async () => {
    const { result } = await renderHook(() => useLife(), { wrapper: wrapper('user_d') });
    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });
    await act(async () => {
      await result.current.updateSettings({ firstName: 'Rayan' });
      await result.current.erase();
    });
    expect(await AsyncStorage.getItem('@app/life:user_d')).toBeNull();
    expect(result.current.state.settings.firstName).toBeUndefined();
  });

  it('applies a batch of writes in one save', async () => {
    const { result } = await renderHook(() => useLife(), { wrapper: wrapper('user_e') });
    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });
    await act(async () => {
      await result.current.apply({
        upserts: [
          {
            collection: 'groceries',
            record: { id: 'g1', name: 'Riz', quantity: '500 g', estimatedCost: 1.2, checked: false },
          },
        ],
        deletes: [],
      });
    });
    expect(result.current.state.groceries.map((g) => g.name)).toEqual(['Riz']);
  });
});
