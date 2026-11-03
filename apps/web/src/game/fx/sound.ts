import { useSyncExternalStore } from 'react';
import { SCHEDULE, type Cue } from './cues';

const STORAGE_KEY = 'quiz:sound';

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

let enabled = read();
const listeners = new Set<() => void>();

let ctx: AudioContext | null = null;
let master: AudioNode | null = null;
const lastPlayed = new Map<Cue, number>();

type AudioWindow = typeof window & { webkitAudioContext?: typeof AudioContext };

/** Created lazily, and only from a user gesture or after one, so browsers allow it to run. */
function audio() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  // A gentle limiter so overlapping cues never clip.
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 6;
  const gain = ctx.createGain();
  gain.gain.value = 0.85;
  comp.connect(gain);
  gain.connect(ctx.destination);
  master = comp;
  return ctx;
}

/** Call from the first tap/key: browsers keep audio suspended until the player interacts. */
export function unlockAudio() {
  const c = audio();
  if (c && c.state !== 'running') void c.resume().catch(() => {});
}

/** The app was backgrounded: iOS suspends audio, so wake it up when the player is back. */
export function resumeAudioIfNeeded() {
  if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => {});
}

export function play(cue: Cue, delaySeconds = 0) {
  if (!enabled || document.visibilityState === 'hidden') return;
  const c = audio();
  if (!c || !master) return;
  // The same cue twice within a few ms (e.g. a tap and its echo from the server) is one sound.
  const now = performance.now();
  if (now - (lastPlayed.get(cue) ?? 0) < 60) return;
  lastPlayed.set(cue, now);
  if (c.state !== 'running') void c.resume().catch(() => {});
  try {
    SCHEDULE[cue](c, master, c.currentTime + 0.005 + delaySeconds);
  } catch {
    // Audio must never break the game.
  }
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // Not persisted (private mode): the choice still holds for this session.
  }
  listeners.forEach((l) => l());
  if (on) unlockAudio();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useSoundEnabled() {
  return useSyncExternalStore(subscribe, () => enabled, () => true);
}
