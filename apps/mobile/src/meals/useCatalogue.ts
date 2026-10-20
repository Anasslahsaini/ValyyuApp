import { loadCatalogue, loadedCatalogue, type CatalogueData } from '@workspace/domain/recipe-catalogue';
import { useCallback, useEffect, useState } from 'react';

/** The 242-recipe catalogue, parsed on first use; `error` when it could not be read, `retry` to try again. */
export function useCatalogue() {
  const [data, setData] = useState<CatalogueData | null>(loadedCatalogue());
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (data) return;
    let alive = true;
    loadCatalogue().then(
      (d) => {
        if (alive) setData(d);
      },
      () => {
        if (alive) setError(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [data, attempt]);
  const retry = useCallback(() => {
    setError(false);
    setAttempt((n) => n + 1);
  }, []);
  return { data, error, retry };
}
