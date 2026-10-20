import { createContext, useContext } from 'react';

/** Where the person is in the app's entry flow (set by the root layout). */
export const GateContext = createContext<{ signedIn: boolean; onboarded: boolean }>({
  signedIn: false,
  onboarded: false,
});
export const useGate = () => useContext(GateContext);
