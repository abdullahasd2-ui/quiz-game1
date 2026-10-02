/** Game server origin: empty on the web (same origin); the mobile app is built with VITE_SERVER_URL. */
export const SERVER_URL: string = (import.meta.env.VITE_SERVER_URL ?? '').replace(/\/$/, '');

/** Public site for invite links (the app itself runs from a local origin). */
export const PUBLIC_URL = SERVER_URL || location.origin;

/** Resolves server-relative paths (`/api/...`, `/uploads/...`) against the game server; full URLs pass through. */
export const serverUrl = (path: string) => (path.startsWith('/') && !path.startsWith('//') ? SERVER_URL + path : path);
