import { renderHook, waitFor } from '@testing-library/react-native';

const mockUseFonts = jest.fn();
jest.mock('@expo-google-fonts/bricolage-grotesque', () => ({
  BricolageGrotesque_700Bold: 1,
  useFonts: (...args: unknown[]) => mockUseFonts(...args),
}));
const mockInitI18n = jest.fn();
jest.mock('@workspace/i18n', () => ({ initI18n: (...args: unknown[]) => mockInitI18n(...args) }));

import { useAppReady } from '../src/useAppReady';

describe('useAppReady', () => {
  it('waits for the font and the translations', async () => {
    mockUseFonts.mockReturnValue([false, null]);
    mockInitI18n.mockResolvedValue(undefined);
    const { result } = await renderHook(() => useAppReady());
    await waitFor(() => {
      expect(mockInitI18n).toHaveBeenCalled();
    });
    expect(result.current).toBe(false);
  });

  it('still opens the app when the title font fails to load (system font fallback)', async () => {
    mockUseFonts.mockReturnValue([false, new Error('font')]);
    mockInitI18n.mockResolvedValue(undefined);
    const { result } = await renderHook(() => useAppReady());
    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('still opens the app when translations fail to start', async () => {
    mockUseFonts.mockReturnValue([true, null]);
    mockInitI18n.mockRejectedValue(new Error('i18n'));
    const { result } = await renderHook(() => useAppReady());
    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });
});
