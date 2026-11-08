import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { deal, newStream, streamerAct, toBoard, chatMessage, type StreamState, type SyncView } from '@quiz/shared';
import { Server } from 'socket.io';
import { io as client } from 'socket.io-client';
import { describe, expect, it } from 'vitest';
import { attachKickSync } from './sync';

const q = { text: 'س؟', options: ['أ', 'ب', 'ج', 'د'], correctIndex: 2, points: 300, imageUrl: null };

describe('kick sync', () => {
  it('the broadcast page gets the game without the streamer secret, and only the owner can publish', async () => {
    const http = createServer();
    const io = new Server(http);
    attachKickSync(io);
    await new Promise<void>((r) => http.listen(0, r));
    const url = `http://localhost:${(http.address() as AddressInfo).port}/kick-sync`;
    const host = client(url);
    const watcher = client(url);
    const thief = client(url);
    const ack = (s: ReturnType<typeof client>, ev: 'sync:publish' | 'sync:watch', arg: unknown) => new Promise<{ ok: boolean }>((res) => s.emit(ev, arg, res));

    let state: StreamState = chatMessage(newStream('S', 6), 'Ali', 'دخول');
    state = streamerAct(deal(toBoard(state), '1:300', q, 0), { type: 'answer', index: 2 }, 0);
    const views: SyncView[] = [];
    watcher.on('sync:view', (v: SyncView) => views.push(v));
    expect((await ack(watcher, 'sync:watch', 'ROOM1234')).ok).toBe(true);
    expect((await ack(host, 'sync:publish', { code: 'ROOM1234', hostKey: 'k'.repeat(20), state, hostNow: 1 })).ok).toBe(true);
    expect((await ack(thief, 'sync:publish', { code: 'ROOM1234', hostKey: 'x'.repeat(20), state: null, hostNow: 2 })).ok).toBe(false);
    await new Promise((r) => setTimeout(r, 100));

    expect(views).toHaveLength(1);
    const text = JSON.stringify(views[0]);
    expect(text).not.toContain('"correctIndex":2');
    expect(views[0]!.state?.round?.streamer).toBeNull();
    host.close(); watcher.close(); thief.close();
    io.close();
  });
});

describe('kick sync picks', () => {
  it('a page watching the code can pick a cell; it reaches only the control page', async () => {
    const http = createServer();
    const io = new Server(http);
    attachKickSync(io);
    await new Promise<void>((r) => http.listen(0, r));
    const url = `http://localhost:${(http.address() as AddressInfo).port}/kick-sync`;
    const host = client(url);
    const screen = client(url);
    const stranger = client(url);
    const ack = (s: ReturnType<typeof client>, ev: string, arg: unknown) => new Promise<{ ok: boolean }>((res) => s.emit(ev, arg, res));
    const got: unknown[] = [];
    host.on('sync:pick', (m: unknown) => got.push(m));
    await ack(host, 'sync:publish', { code: 'PICK1234', hostKey: 'k'.repeat(20), state: null, hostNow: 1 });
    expect((await ack(stranger, 'sync:pick', { code: 'PICK1234', category: 1, points: 100 })).ok).toBe(false); // not watching
    await ack(screen, 'sync:watch', 'PICK1234');
    expect((await ack(screen, 'sync:pick', { code: 'PICK1234', category: 3, points: 300 })).ok).toBe(true);
    await new Promise((r) => setTimeout(r, 100));
    expect(got).toEqual([{ code: 'PICK1234', category: 3, points: 300 }]);
    host.close(); screen.close(); stranger.close();
    io.close();
  });
});
