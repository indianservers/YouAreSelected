// A synchronized display clock uses monotonic elapsed time. Changing the local
// wall clock cannot reset or extend the displayed countdown between polls.
let anchor: { server: number; monotonic: number } | undefined;
export function syncServerClock(timestamp: string) {
  const server = Date.parse(timestamp);
  if (Number.isFinite(server))
    anchor = { server, monotonic: performance.now() };
}
export function serverTime() {
  return anchor
    ? anchor.server + performance.now() - anchor.monotonic
    : Date.now();
}
