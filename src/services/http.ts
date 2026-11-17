export type HttpErrorKind = 'offline' | 'network' | 'timeout' | 'http' | 'auth' | 'parse' | 'config';

export class HttpError extends Error {
  kind: HttpErrorKind;
  status?: number;
  constructor(kind: HttpErrorKind, message: string, status?: number) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

export const isHttpError = (e: unknown): e is HttpError => e instanceof HttpError;

async function request(url: string, init: RequestInit = {}, timeoutMs = 12000): Promise<Response> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new HttpError('offline', 'You are offline');
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (res.status === 401 || res.status === 403) {
      throw new HttpError('auth', `Not authorized (${res.status})`, res.status);
    }
    if (!res.ok) throw new HttpError('http', `Request failed (${res.status})`, res.status);
    return res;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    if ((e as Error)?.name === 'AbortError') throw new HttpError('timeout', 'The request timed out');
    throw new HttpError('network', 'Network error — the service may be unreachable or blocked');
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs?: number): Promise<T> {
  const res = await request(url, init, timeoutMs);
  try {
    return (await res.json()) as T;
  } catch {
    throw new HttpError('parse', 'Unexpected response format');
  }
}

export async function fetchText(url: string, init?: RequestInit, timeoutMs?: number): Promise<string> {
  const res = await request(url, init, timeoutMs);
  return res.text();
}

export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') u.set(k, String(v));
  }
  return u.toString();
}

/** Run a task per item with limited parallelism (keeps us inside public API rate limits). */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        out[idx] = { status: 'fulfilled', value: await fn(items[idx]) };
      } catch (reason) {
        out[idx] = { status: 'rejected', reason };
      }
    }
  });
  await Promise.all(workers);
  return out;
}
