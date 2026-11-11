// Requests shared between pages. The analysis page starts the slow requests as soon as the user
// presses "start analysis", and the results page then reuses the same request instead of starting again.
// A failed request is forgotten, so the next attempt asks again. A finished one is kept for 10 minutes.
const KEEP_MS = 10 * 60_000;
const requests = new Map<string, Promise<unknown>>();

// The same point gives the same key, however it was read (from the address bar or from the database).
export function pointKey(lat: number, lng: number): string {
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export function shared<T>(key: string, start: () => Promise<T>): Promise<T> {
  const old = requests.get(key) as Promise<T> | undefined;
  if (old) return old;
  const request = start();
  requests.set(key, request);
  request.then(
    () => setTimeout(() => requests.delete(key), KEEP_MS),
    () => requests.delete(key),
  );
  return request;
}

// Waits for a shared request. When the page stops waiting, only this page stops: the request goes on for the others.
export function waitFor<T>(request: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return request;
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const stop = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", stop, { once: true });
    request.then(resolve, reject).finally(() => signal.removeEventListener("abort", stop));
  });
}
