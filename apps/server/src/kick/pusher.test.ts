import { describe, expect, it } from 'vitest';
import { KICK_PUSHER_FALLBACK, kickPusherUrl } from '@quiz/shared';

describe("Kick's chat-feed key", () => {
  it('reads the current key from Kick, and falls back when Kick does not answer', async () => {
    const { kickPusher } = await import('./pusher');
    const down = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    expect(await kickPusher(down)).toEqual(KICK_PUSHER_FALLBACK);
    const answer = (async () =>
      new Response(JSON.stringify({ data: { connections: [{ provider: 'pusher', credentials: { app_key: 'abc123', cluster: 'eu' } }] } }), { status: 200 })) as unknown as typeof fetch;
    expect(await kickPusher(answer)).toEqual({ key: 'abc123', cluster: 'eu' });
    expect(kickPusherUrl({ key: 'abc123', cluster: 'eu' })).toMatch(/^wss:\/\/ws-eu\.pusher\.com\/app\/abc123\?protocol=7/);
  });
});
