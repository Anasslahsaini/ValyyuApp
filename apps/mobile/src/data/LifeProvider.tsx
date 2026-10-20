import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  deleteRecord,
  LifeSchema,
  newLifeState,
  upsertRecord,
  type Collection,
  type CollectionRecord,
  type LifeSettings,
  type LifeState,
} from '@workspace/domain/life';
import type { Writes } from '@workspace/domain/week-writes';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/**
 * The only door to the person's data (V1: on the phone). Screens never touch storage directly, so the
 * future server sync plugs in here without changing them. One key per account.
 */
type LifeContextValue = {
  state: LifeState;
  ready: boolean;
  updateSettings: (patch: Partial<LifeSettings>) => Promise<void>;
  save: <K extends Collection>(collection: K, record: CollectionRecord<K>) => Promise<void>;
  remove: (collection: Collection, id: string) => Promise<void>;
  /** Several writes in one save (all or nothing), e.g. a week plan and its grocery list. */
  apply: (writes: Writes) => Promise<void>;
  erase: () => Promise<void>;
};

const LifeContext = createContext<LifeContextValue | null>(null);
const storageKey = (userId: string) => `@app/life:${userId}`;

function parse(raw: string | null): LifeState {
  if (!raw) return newLifeState();
  try {
    const parsed = LifeSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : newLifeState();
  } catch {
    return newLifeState();
  }
}

export function LifeProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [state, setState] = useState<LifeState>(newLifeState);
  const [ready, setReady] = useState(false);
  const stateRef = useRef(state);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(storageKey(userId))
      .catch(() => null)
      .then((raw) => {
        if (!active) return;
        const loaded = parse(raw);
        stateRef.current = loaded;
        setState(loaded);
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  // Writes run one after another: two quick taps never overwrite each other.
  const commit = useCallback(
    (transform: (previous: LifeState) => LifeState) => {
      const run = queueRef.current.then(async () => {
        const next = LifeSchema.parse(transform(stateRef.current));
        await AsyncStorage.setItem(storageKey(userId), JSON.stringify(next));
        stateRef.current = next;
        setState(next);
      });
      queueRef.current = run.catch(() => undefined);
      return run;
    },
    [userId],
  );

  const value = useMemo<LifeContextValue>(
    () => ({
      state,
      ready,
      updateSettings: (patch) =>
        commit((previous) => ({ ...previous, settings: { ...previous.settings, ...patch } })),
      save: (collection, record) => commit((previous) => upsertRecord(previous, collection, record)),
      remove: (collection, id) => commit((previous) => deleteRecord(previous, collection, id)),
      apply: (writes) =>
        commit((previous) => {
          let next = previous;
          for (const d of writes.deletes) next = deleteRecord(next, d.collection, d.id);
          for (const u of writes.upserts) next = upsertRecord(next, u.collection, u.record);
          return next;
        }),
      erase: async () => {
        await queueRef.current;
        await AsyncStorage.removeItem(storageKey(userId));
        const empty = newLifeState();
        stateRef.current = empty;
        setState(empty);
      },
    }),
    [state, ready, commit, userId],
  );

  return <LifeContext.Provider value={value}>{children}</LifeContext.Provider>;
}

export function useLife(): LifeContextValue {
  const value = useContext(LifeContext);
  if (!value) throw new Error('useLife must be used inside LifeProvider');
  return value;
}
