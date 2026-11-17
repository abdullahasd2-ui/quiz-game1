import { describe, expect, it, vi } from 'vitest';
import { parseKickFrame } from '@quiz/shared';
import { KickChatHub, type Connect } from './chat';

const frame = (content: string, username = 'ali') =>
  JSON.stringify({ event: 'App\\Events\\ChatMessageEvent', channel: 'chatrooms.1.v2', data: JSON.stringify({ content, sender: { username } }) });

describe('parseKickFrame', () => {
  it('extracts the sender and text of a chat message', () => {
    expect(parseKickFrame(frame('دخول', 'Sara'))).toEqual({ user: 'Sara', text: 'دخول' });
  });
  it('drops emote markup, other events and garbage', () => {
    expect(parseKickFrame(frame('5 B3 [emote:37226:KEKW]'))).toEqual({ user: 'ali', text: '5 B3' });
    expect(parseKickFrame(frame('[emote:1:x]'))).toBeNull();
    expect(parseKickFrame(JSON.stringify({ event: 'pusher:ping', data: '{}' }))).toBeNull();
    expect(parseKickFrame('not json')).toBeNull();
  });
});

function fakeHub(opts: { fail?: boolean } = {}) {
  const handlers: Parameters<Connect>[1][] = [];
  const closed = vi.fn();
  const connect: Connect = vi.fn((_, h) => {
    handlers.push(h);
    return { close: closed };
  });
  const resolve = vi.fn(async () => {
    if (opts.fail) throw new Error('blocked');
    return 42;
  });
  return { hub: new KickChatHub({ connect, resolve, retryMs: 1, handshakeMs: 30 }), handlers, closed, connect, resolve };
}
const listener = () => ({ onMessage: vi.fn(), onStatus: vi.fn() });
const tick = () => new Promise((r) => setTimeout(r, 5));

describe('KickChatHub', () => {
  it('shares one upstream between watchers and closes it when the last one leaves', async () => {
    const { hub, handlers, closed, connect, resolve } = fakeHub();
    const a = listener();
    const b = listener();
    const stopA = hub.watch('Streamer', undefined, a);
    const stopB = hub.watch('streamer', undefined, b);
    await tick();
    expect(connect).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledTimes(1);
    handlers[0]!.onLive();
    handlers[0]!.onMessage({ user: 'x', text: 'دخول' });
    expect(a.onStatus).toHaveBeenLastCalledWith({ state: 'live' });
    expect(b.onMessage).toHaveBeenCalledWith({ user: 'x', text: 'دخول' });
    // A late watcher is told the current status straight away.
    const c = listener();
    hub.watch('streamer', undefined, c);
    expect(c.onStatus).toHaveBeenCalledWith({ state: 'live' });
    stopA();
    stopB();
    expect(closed).not.toHaveBeenCalled();
    hub.closeAll();
    expect(closed).toHaveBeenCalled();
  });

  it('a linked channel also reads the public chat, and a message that comes both ways is delivered once', async () => {
    const { hub, handlers, connect } = fakeHub();
    const a = listener();
    hub.watch('Streamer', undefined, a, true);
    expect(a.onStatus).toHaveBeenLastCalledWith({ state: 'live' });
    await tick();
    expect(connect).toHaveBeenCalledTimes(1);
    // Kick's webhook never delivers for this account: the public chat still brings the messages.
    handlers[0]!.onMessage({ user: 'Ali', text: 'دخول' });
    expect(a.onMessage).toHaveBeenCalledTimes(1);
    // The same message from the webhook a moment later is not counted twice; a new one is.
    hub.ingest('streamer', { user: 'ali', text: 'دخول' });
    expect(a.onMessage).toHaveBeenCalledTimes(1);
    hub.ingest('streamer', { user: 'ali', text: '2' });
    expect(a.onMessage).toHaveBeenCalledTimes(2);
    hub.closeAll();
  });

  it('a linked channel stays live when the public chat can not be read (the webhook still works)', async () => {
    const { hub } = fakeHub({ fail: true });
    const a = listener();
    hub.watch('blocked', undefined, a, true);
    await tick();
    expect(a.onStatus).not.toHaveBeenCalledWith(expect.objectContaining({ state: 'error' }));
    hub.ingest('blocked', { user: 'x', text: 'دخول' });
    expect(a.onMessage).toHaveBeenCalledWith({ user: 'x', text: 'دخول' });
    hub.closeAll();
  });

  it('uses a given chatroom id without looking it up', async () => {
    const { hub, connect, resolve } = fakeHub();
    hub.watch('s', 77, listener());
    await tick();
    expect(resolve).not.toHaveBeenCalled();
    expect(connect).toHaveBeenCalledWith(77, expect.anything());
  });

  it('reports an error when the channel cannot be resolved', async () => {
    const { hub } = fakeHub({ fail: true });
    const l = listener();
    hub.watch('s', undefined, l);
    await tick();
    expect(l.onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'error' }));
  });

  it('reconnects after the upstream drops while someone is watching', async () => {
    const { hub, handlers, connect } = fakeHub();
    const l = listener();
    hub.watch('s', undefined, l);
    await tick();
    handlers[0]!.onClose();
    expect(l.onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'connecting' }));
    await tick();
    expect(connect).toHaveBeenCalledTimes(2);
    hub.closeAll();
  });

  it('gives up with a clear error when Kick never confirms the subscription', async () => {
    const { hub, closed } = fakeHub();
    const l = listener();
    hub.watch('s', undefined, l);
    await tick();
    expect(l.onStatus).toHaveBeenLastCalledWith({ state: 'connecting', detail: 'جاري الاتصال بالشات...' });
    await new Promise((r) => setTimeout(r, 60));
    expect(l.onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'error', detail: expect.stringContaining('ما رد شات Kick') }));
    expect(closed).toHaveBeenCalled();
  });

  it('says which channel could not be found and why', async () => {
    const { hub } = fakeHub({ fail: true });
    const l = listener();
    hub.watch('Nobody', undefined, l);
    await tick();
    expect(l.onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ detail: expect.stringContaining('nobody') }));
    expect(l.onStatus).toHaveBeenCalledWith({ state: 'connecting', detail: 'جاري البحث عن القناة...' });
  });
});
