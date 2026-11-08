import { createHash, createVerify, randomBytes } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import type { KickMessage } from '@quiz/shared';
import type { KickChatHub } from './chat';

// Official Kick app: the streamer links their account (OAuth 2.1 + PKCE), we subscribe to their
// chat.message.sent event, and Kick POSTs every chat message to /webhook (RSA-signed).

const AUTHORIZE = 'https://id.kick.com/oauth/authorize';
const TOKEN = 'https://id.kick.com/oauth/token';
const API = 'https://api.kick.com/public/v1';
const SCOPES = 'user:read channel:read events:subscribe';

const b64url = (b: Buffer) => b.toString('base64url');

type Opts = {
  hub: KickChatHub;
  clientId?: string;
  clientSecret?: string;
  origin: string;
  fetchImpl?: typeof fetch;
  /** A streamer linked their account (for the admin stats). */
  onLinked?: (kickUserId: number, channel: string) => Promise<void>;
};

export const kickOAuthRoutes: FastifyPluginAsync<Opts> = async (app, opts) => {
  const f = opts.fetchImpl ?? fetch;
  const enabled = Boolean(opts.clientId && opts.clientSecret);
  const redirectUri = `${opts.origin}/api/kick/callback`;
  const pending = new Map<string, { verifier: string; exp: number; next: string }>();
  let publicKey: string | null = null;

  app.get('/api/kick/status', async () => ({ enabled }));

  app.get<{ Querystring: { next?: string } }>('/api/kick/login', async (req, reply) => {
    if (!enabled) return reply.code(503).send({ error: 'ربط Kick غير مفعّل' });
    for (const [k, v] of pending) if (v.exp < Date.now()) pending.delete(k);
    const verifier = b64url(randomBytes(32));
    const state = b64url(randomBytes(16));
    pending.set(state, { verifier, exp: Date.now() + 10 * 60_000, next: req.query.next === 'quiz' ? '/kick/quiz' : '/kick' });
    const url = new URL(AUTHORIZE);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: opts.clientId!,
      redirect_uri: redirectUri,
      scope: SCOPES,
      code_challenge: b64url(createHash('sha256').update(verifier).digest()),
      code_challenge_method: 'S256',
      state,
    }).toString();
    return reply.redirect(url.toString());
  });

  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>('/api/kick/callback', async (req, reply) => {
    const { code, state } = req.query;
    const entry = state ? pending.get(state) : undefined;
    const back = entry?.next ?? '/kick';
    const fail = (why: string) => reply.redirect(`${back}?kick_error=${encodeURIComponent(why)}`);
    if (!enabled || req.query.error || !code || !entry || entry.exp < Date.now()) return fail('تعذّر الربط، جرّب مرة ثانية');
    pending.delete(state!);
    try {
      const tokenRes = await f(TOKEN, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: opts.clientId!,
          client_secret: opts.clientSecret!,
          redirect_uri: redirectUri,
          code_verifier: entry.verifier,
          code,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!tokenRes.ok) throw new Error(`token ${tokenRes.status}`);
      const { access_token } = (await tokenRes.json()) as { access_token: string };
      const auth = { authorization: `Bearer ${access_token}` };

      const userRes = await f(`${API}/users`, { headers: auth, signal: AbortSignal.timeout(10_000) });
      if (!userRes.ok) throw new Error(`users ${userRes.status}`);
      const me = ((await userRes.json()) as { data?: { user_id?: number; name?: string }[] }).data?.[0];
      if (!me?.user_id || !me.name) throw new Error('no user');

      const subRes = await f(`${API}/events/subscriptions`, {
        method: 'POST',
        headers: { ...auth, 'content-type': 'application/json' },
        body: JSON.stringify({ broadcaster_user_id: me.user_id, events: [{ name: 'chat.message.sent', version: 1 }], method: 'webhook' }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!subRes.ok) throw new Error(`subscribe ${subRes.status} ${(await subRes.text()).slice(0, 200)}`);
      await opts.onLinked?.(me.user_id, me.name).catch((err) => app.log.warn({ err }, 'kick link stats'));
      return reply.redirect(`${back}?linked=${encodeURIComponent(me.name)}`);
    } catch (err) {
      app.log.warn({ err }, 'kick link failed');
      return fail('تعذّر الربط مع Kick، جرّب مرة ثانية');
    }
  });

  // The webhook needs the exact bytes Kick signed, so this scope keeps JSON bodies as strings.
  await app.register(async (hook) => {
    hook.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => done(null, body));
    hook.post('/api/kick/webhook', async (req, reply) => {
      const raw = String(req.body ?? '');
      const h = req.headers;
      const id = String(h['kick-event-message-id'] ?? '');
      const ts = String(h['kick-event-message-timestamp'] ?? '');
      const sig = String(h['kick-event-signature'] ?? '');
      try {
        if (!publicKey) {
          const r = await f(`${API}/public-key`, { signal: AbortSignal.timeout(10_000) });
          publicKey = ((await r.json()) as { data?: { public_key?: string } }).data?.public_key ?? null;
        }
        const ok = publicKey && createVerify('RSA-SHA256').update(`${id}.${ts}.${raw}`).verify(publicKey, sig, 'base64');
        if (!ok) return reply.code(400).send({ error: 'bad signature' });
      } catch (err) {
        app.log.warn({ err }, 'kick webhook verify failed');
        return reply.code(400).send({ error: 'verify failed' });
      }
      if (h['kick-event-type'] === 'chat.message.sent') {
        const p = JSON.parse(raw) as {
          broadcaster?: { username?: string; channel_slug?: string };
          sender?: { username?: string };
          content?: string;
        };
        const text = (p.content ?? '').replace(/\[emote:\d+:[^\]]*\]/g, '').trim();
        const user = p.sender?.username;
        const m: KickMessage | null = user && text ? { user, text } : null;
        if (m) for (const name of new Set([p.broadcaster?.username, p.broadcaster?.channel_slug].map((n) => n?.toLowerCase()))) if (name) opts.hub.ingest(name, m);
      }
      return reply.code(200).send({ ok: true });
    });
  });
};
