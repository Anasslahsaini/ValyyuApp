import { initI18n } from '@workspace/i18n';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));

const ok = { error: null };
const mockClient = {
  signIn: { emailCode: { sendCode: jest.fn(), verifyCode: jest.fn() }, finalize: jest.fn() },
  signUp: {
    create: jest.fn(),
    verifications: { sendEmailCode: jest.fn(), verifyEmailCode: jest.fn() },
    finalize: jest.fn(),
  },
};
jest.mock('../src/auth/useEmailCodeClient', () => ({ useEmailCodeClient: () => mockClient }));
const mockStartSSOFlow = jest.fn();
jest.mock('@clerk/expo/experimental', () => ({ useSSO: () => ({ startSSOFlow: mockStartSSOFlow }) }));

import CodeScreen from '../app/(auth)/code';
import EmailScreen from '../app/(auth)/email';
import Welcome from '../app/(auth)/welcome';

beforeAll(async () => {
  await initI18n(['fr-FR']);
});
beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockClient.signIn.emailCode.sendCode.mockResolvedValue(ok);
  mockClient.signIn.emailCode.verifyCode.mockResolvedValue(ok);
  mockClient.signIn.finalize.mockResolvedValue(ok);
});

describe('C1 · Bienvenue', () => {
  it('offers Google and email, and keeps Apple off until the store build', async () => {
    await render(<Welcome />);
    expect(screen.getByRole('button', { name: 'Continuer avec Apple' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Continuer avec Google' })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer avec un e-mail' }));
    expect(mockPush).toHaveBeenCalledWith('/email');
  });

  it('starts Google sign-in', async () => {
    mockStartSSOFlow.mockResolvedValue({ createdSessionId: 'sess_1' });
    await render(<Welcome />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer avec Google' }));
    expect(mockStartSSOFlow).toHaveBeenCalledWith({ strategy: 'oauth_google' });
  });
});

describe('C2 / C6 · E-mail', () => {
  it('sends the code and opens the code screen', async () => {
    await render(<EmailScreen />);
    await fireEvent.changeText(screen.getByLabelText('Adresse e-mail'), 'Rayan@Exemple.fr');
    await fireEvent.press(screen.getByRole('button', { name: 'Recevoir le code' }));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/code',
        params: { email: 'rayan@exemple.fr', flow: 'signIn' },
      });
    });
  });

  it('explains a malformed address without calling Clerk', async () => {
    await render(<EmailScreen />);
    await fireEvent.changeText(screen.getByLabelText('Adresse e-mail'), 'rayan@exemple');
    await fireEvent.press(screen.getByRole('button', { name: 'Recevoir le code' }));
    expect(await screen.findByText("Il manque une partie de l'adresse (ex. : .fr).")).toBeOnTheScreen();
    expect(mockClient.signIn.emailCode.sendCode).not.toHaveBeenCalled();
  });

  it('shows the offline banner and turns the button into Réessayer', async () => {
    mockClient.signIn.emailCode.sendCode.mockRejectedValue(new TypeError('Network request failed'));
    await render(<EmailScreen />);
    await fireEvent.changeText(screen.getByLabelText('Adresse e-mail'), 'rayan@exemple.fr');
    await fireEvent.press(screen.getByRole('button', { name: 'Recevoir le code' }));
    expect(await screen.findByRole('alert')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeOnTheScreen();
  });
});

describe('C3 / C4 / C5 · Code', () => {
  it('verifies as soon as the 6th digit is typed', async () => {
    mockParams = { email: 'rayan@exemple.fr', flow: 'signIn' };
    await render(<CodeScreen />);
    expect(screen.getByText('On l’a envoyé à rayan@exemple.fr'.replace('’', "'"))).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Code à 6 chiffres'), '482719');
    await waitFor(() => {
      expect(mockClient.signIn.finalize).toHaveBeenCalled();
    });
    expect(mockClient.signIn.emailCode.verifyCode).toHaveBeenCalledWith({ code: '482719' });
  });

  it('shows the wrong-code error and empties the boxes', async () => {
    mockParams = { email: 'rayan@exemple.fr', flow: 'signIn' };
    mockClient.signIn.emailCode.verifyCode.mockResolvedValue({ error: { code: 'form_code_incorrect' } });
    await render(<CodeScreen />);
    await fireEvent.changeText(screen.getByLabelText('Code à 6 chiffres'), '000000');
    expect(
      await screen.findByText('Ce code ne marche pas. Vérifie les chiffres, ou demande un nouveau code.'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Code à 6 chiffres').props.value).toBe('');
    expect(mockClient.signIn.finalize).not.toHaveBeenCalled();
  });

  it('lets the code be resent only after the wait', async () => {
    mockParams = { email: 'rayan@exemple.fr', flow: 'signIn' };
    await render(<CodeScreen />);
    expect(screen.getByTestId('auth-resend')).toBeDisabled();
  });
});
