/** Game server origin: empty on the web (same origin); the mobile app is built with VITE_SERVER_URL. */
export const SERVER_URL: string = (import.meta.env.VITE_SERVER_URL ?? '').replace(/\/$/, '');

/** Public site for invite links (the app itself runs from a local origin). */
export const PUBLIC_URL = SERVER_URL || location.origin;

/** Resolves server-relative paths (`/api/...`, `/uploads/...`) against the game server; full URLs pass through. */
export const serverUrl = (path: string) => (path.startsWith('/') && !path.startsWith('//') ? SERVER_URL + path : path);

/**
 * Where a question's picture loads from:
 *  - `legacy-draw:<name>`: the old canvas drawings, now shipped as images with the site;
 *  - pictures hosted elsewhere (imgur): through our server, which keeps a copy (outside hosts block or drop them);
 *  - our own uploads: from the game server.
 */
export const imageSrc = (url: string) => {
  if (url.startsWith('legacy-draw:')) return serverUrl(`/legacy-draw/${url.slice('legacy-draw:'.length)}.png`);
  if (/^https?:\/\//.test(url)) return serverUrl(`/api/img?u=${encodeURIComponent(url)}`);
  return serverUrl(url);
};
