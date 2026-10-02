import type { RoomView } from '@quiz/shared';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getSocket, savedRoom, send } from './connection';

export type RoomState = {
  view: RoomView | null;
  /** Local-clock deadline of the running action/answer timer. */
  deadline: number | null;
  connected: boolean;
  /** True while rejoining a saved room after a refresh or reconnect. */
  resuming: boolean;
};

/** Subscribes to the live room and rejoins the saved one whenever the socket (re)connects. */
export function useRoom() {
  const [state, setState] = useState<RoomState>(() => ({
    view: null,
    deadline: null,
    connected: false,
    resuming: savedRoom.get() !== null,
  }));

  useEffect(() => {
    const socket = getSocket();

    const resume = async () => {
      setState((s) => ({ ...s, connected: true }));
      const code = savedRoom.get();
      if (!code) return;
      setState((s) => ({ ...s, resuming: true }));
      const res = await send('room:join', { code });
      if (!res.ok) {
        savedRoom.set(null);
        setState((s) => ({ ...s, view: null, deadline: null, resuming: false }));
      }
    };
    const onState = (view: RoomView) => {
      savedRoom.set(view.code);
      setState((s) => ({
        ...s,
        view,
        deadline: view.remainingMs === null ? null : Date.now() + view.remainingMs,
        resuming: false,
      }));
    };
    const onClosed = (reason: string) => {
      savedRoom.set(null);
      toast.info(reason);
      setState((s) => ({ ...s, view: null, deadline: null, resuming: false }));
    };
    const onDisconnect = () => setState((s) => ({ ...s, connected: false }));
    const onConnectError = () => setState((s) => ({ ...s, connected: false, resuming: false }));

    socket.on('connect', resume);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('room:state', onState);
    socket.on('room:closed', onClosed);
    if (socket.connected) void resume();
    return () => {
      socket.off('connect', resume);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('room:state', onState);
      socket.off('room:closed', onClosed);
    };
  }, []);

  const leave = async () => {
    await send('room:leave');
    savedRoom.set(null);
    setState((s) => ({ ...s, view: null, deadline: null }));
  };

  return { ...state, leave };
}
