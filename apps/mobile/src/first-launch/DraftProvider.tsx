import type { FirstLaunchDraft } from '@workspace/domain/first-launch/finish';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/** Answers kept in memory across the first-launch steps; saved only at the end (nothing is kept under 15). */
type DraftValue = {
  draft: FirstLaunchDraft;
  /** `undefined` clears an answer. */
  update: (patch: { [K in keyof FirstLaunchDraft]?: FirstLaunchDraft[K] | undefined }) => void;
  consent: boolean;
  setConsent: (value: boolean) => void;
};

const DraftContext = createContext<DraftValue | null>(null);

export function DraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<FirstLaunchDraft>({
    people: 1,
    sessionsPerWeek: 3,
    diet: [],
    allergies: [],
  });
  const [consent, setConsent] = useState(false);
  const value = useMemo<DraftValue>(
    () => ({
      draft,
      update: (patch) => {
        setDraft((previous) => {
          const merged: Record<string, unknown> = { ...previous, ...patch };
          return Object.fromEntries(Object.entries(merged).filter(([, value]) => value !== undefined));
        });
      },
      consent,
      setConsent,
    }),
    [draft, consent],
  );
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft(): DraftValue {
  const value = useContext(DraftContext);
  if (!value) throw new Error('useDraft must be used inside DraftProvider');
  return value;
}
