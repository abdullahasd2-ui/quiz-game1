import { KICK_PUSHER_FALLBACK, type KickPusher } from '@quiz/shared';

// Kick rotates the key of its chat feed. Its own web client asks for the current one here (the browser can't:
// web.kick.com refuses other sites), and offering only "pusher" keeps the answer a Pusher key.
const URL = 'https://web.kick.com/api/v1/realtime/connection';
const SAFE = /^[\w-]{1,64}$/;
const TTL = 60 * 60 * 1000;
let cached: { value: KickPusher; at: number } | null = null;

export async function kickPusher(fetchImpl: typeof fetch = fetch): Promise<KickPusher> {
  if (cached && Date.now() - cached.at < TTL) return cached.value;
  try {
    const res = await fetchImpl(URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ client: { id: crypto.randomUUID(), type: 'web' }, capabilities: { accepted_providers: [{ provider: 'pusher' }] } }),
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const { data } = (await res.json()) as { data?: { connections?: { provider?: string; credentials?: { app_key?: string; cluster?: string } }[] } };
      const c = data?.connections?.find((x) => x.provider === 'pusher')?.credentials;
      if (c?.app_key && c.cluster && SAFE.test(c.app_key) && SAFE.test(c.cluster)) {
        cached = { value: { key: c.app_key, cluster: c.cluster }, at: Date.now() };
        return cached.value;
      }
    }
  } catch {
    // Kick unreachable: the last known key below.
  }
  return cached?.value ?? KICK_PUSHER_FALLBACK;
}
