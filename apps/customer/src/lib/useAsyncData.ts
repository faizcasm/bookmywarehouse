import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { ApiError } from './api';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  /** True while refetching with previous data still available. */
  refreshing: boolean;
  error: ApiError | null;
  reload: () => void;
}

/**
 * Small data-fetching hook: keeps previous data during refetches so polling
 * UIs (messages, notifications) do not flash skeletons.
 */
export function useAsyncData<T>(fetcher: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [version, setVersion] = useState(0);
  const hasDataRef = useRef(false);
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    let cancelled = false;
    if (hasDataRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    fetcherRef
      .current()
      .then((result) => {
        if (cancelled) return;
        hasDataRef.current = true;
        setData(result);
        setLoading(false);
        setRefreshing(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err : new ApiError(0, 'NETWORK_ERROR', 'Network error. Please try again.'));
        setLoading(false);
        setRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` is a caller-provided DependencyList spread into the array; it cannot be listed as a single static dependency.
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { data, loading, refreshing, error, reload };
}
