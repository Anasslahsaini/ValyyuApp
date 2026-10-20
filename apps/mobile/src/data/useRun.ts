import { useCallback, useState } from 'react';

/** One save at a time per screen: `busy` names the running action, `failed` turns true when it threw. */
export function useRun<K extends string>() {
  const [busy, setBusy] = useState<K | null>(null);
  const [failed, setFailed] = useState(false);
  const run = useCallback((kind: K, action: () => Promise<unknown>) => {
    setBusy(kind);
    setFailed(false);
    return action()
      .then(() => true)
      .catch(() => {
        setFailed(true);
        return false;
      })
      .finally(() => {
        setBusy(null);
      });
  }, []);
  return { busy, failed, run };
}
