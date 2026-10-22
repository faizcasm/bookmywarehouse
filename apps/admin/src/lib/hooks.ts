import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet, apiList, ApiError, type Pagination } from './api';

export interface ListState<T> {
  items: T[];
  pagination: Pagination | null;
  loading: boolean;
  error: unknown;
}

/**
 * Fetches a paginated admin list endpoint whenever `params` change.
 * Aborts stale requests; exposes `reload` for after mutations.
 */
export function usePagedList<T>(
  path: string,
  params: Record<string, string | number | undefined>,
): ListState<T> & { reload: () => void } {
  const [state, setState] = useState<ListState<T>>({ items: [], pagination: null, loading: true, error: null });
  const [nonce, setNonce] = useState(0);
  const key = JSON.stringify([path, params, nonce]);
  const keyRef = useRef(key);

  useEffect(() => {
    if (keyRef.current !== key) keyRef.current = key;
    const controller = new AbortController();
    setState((prev) => ({ ...prev, loading: true, error: null }));
    apiList<T>(path, params, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        setState({
          items: res.items,
          pagination: (res.meta?.pagination as Pagination | undefined) ?? null,
          loading: false,
          error: null,
        });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setState({ items: [], pagination: null, loading: false, error: err });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `params` is a fresh object every render; adding it (or deriving deps from it ad hoc) would refetch on every render — the serialized `key` is the intentional dependency.
  }, [key]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { ...state, reload };
}

/** One-shot fetch for detail pages. */
export function useFetch<T>(
  path: string | null,
): { data: T | null; loading: boolean; error: unknown; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    apiGet<T>(path, undefined, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err);
        setLoading(false);
      });
    return () => controller.abort();
  }, [path, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload };
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}
