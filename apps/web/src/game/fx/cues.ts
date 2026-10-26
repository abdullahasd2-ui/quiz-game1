/**
 * Sound cues, synthesized on the fly (no audio files, no background music). They are the in-game cousins of the
 * promo video's sound design (apps/mobile/store/video/src/audio.py): pop, whoosh, bell, boom, win arpeggio, but
 * shorter and softer because players hear them many times per game.
 *
 * Each cue only needs a BaseAudioContext, so the same code runs live (AudioContext) and offline
 * (OfflineAudioContext, used to check levels).
 */

export const CUES = ['tap', 'pop', 'ding', 'whoosh', 'lock', 'tick', 'tickUrgent', 'boom', 'win', 'wrong', 'swap', 'fanfare'] as const;
export type Cue = (typeof CUES)[number];

type Ctx = BaseAudioContext;

const noiseBuffers = new WeakMap<Ctx, AudioBuffer>();
function noiseBuffer(ctx: Ctx) {
  let buf = noiseBuffers.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    // Deterministic noise: the same cue always renders the same way.
    let seed = 0x9e3779b9;
    for (let i = 0; i < data.length; i++) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      data[i] = ((seed >>> 0) / 0xffffffff) * 2 - 1;
    }
    noiseBuffers.set(ctx, buf);
  }
  return buf;
}

/** Exponential attack/decay envelope on a fresh gain node. */
function envelope(ctx: Ctx, out: AudioNode, t: number, peak: number, attack: number, decay: number) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(out);
  return g;
}

type ToneOptions = { type?: OscillatorType; from: number; to?: number; peak: number; attack?: number; decay: number; sweep?: number };

function tone(ctx: Ctx, out: AudioNode, t: number, { type = 'sine', from, to = from, peak, attack = 0.004, decay, sweep }: ToneOptions) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + (sweep ?? decay));
  osc.connect(envelope(ctx, out, t, peak, attack, decay));
  osc.start(t);
  osc.stop(t + attack + decay + 0.05);
}

type NoiseOptions = { filter: BiquadFilterType; from: number; to?: number; q?: number; peak: number; attack: number; decay: number };

function noise(ctx: Ctx, out: AudioNode, t: number, { filter, from, to = from, q = 1, peak, attack, decay }: NoiseOptions) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  if (to !== from) f.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
  src.connect(f);
  f.connect(envelope(ctx, out, t, peak, attack, decay));
  src.start(t);
  src.stop(t + attack + decay + 0.05);
}

/** A bell: two inharmonic sines with a long tail. */
function bell(ctx: Ctx, out: AudioNode, t: number, freq: number, peak: number, decay = 0.7) {
  tone(ctx, out, t, { from: freq, peak, decay, attack: 0.002 });
  tone(ctx, out, t, { from: freq * 2.76, peak: peak * 0.35, decay: decay * 0.5, attack: 0.002 });
}

const NOTE = { C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5, E6: 1318.5, G6: 1568, C7: 2093 };

/** Each cue schedules its sound at time `t` on `out` and returns how long it rings (seconds). */
export const SCHEDULE: Record<Cue, (ctx: Ctx, out: AudioNode, t: number) => number> = {
  /** Any button press. */
  tap(ctx, out, t) {
    tone(ctx, out, t, { type: 'triangle', from: 1900, to: 1250, peak: 0.26, decay: 0.045 });
    return 0.1;
  },
  /** Something appeared: a player joined, a card popped in. */
  pop(ctx, out, t) {
    tone(ctx, out, t, { from: 420, to: 980, peak: 0.36, decay: 0.12, sweep: 0.09 });
    return 0.2;
  },
  /** A room was created / joined. */
  ding(ctx, out, t) {
    bell(ctx, out, t, NOTE.E6, 0.22);
    bell(ctx, out, t + 0.09, NOTE.G6, 0.17, 0.6);
    return 0.9;
  },
  /** A screen change: air sweeping through. */
  whoosh(ctx, out, t) {
    noise(ctx, out, t, { filter: 'bandpass', from: 380, to: 3200, q: 1.3, peak: 0.75, attack: 0.12, decay: 0.26 });
    return 0.45;
  },
  /** A secret choice was locked in. */
  lock(ctx, out, t) {
    tone(ctx, out, t, { from: 170, to: 62, peak: 0.42, decay: 0.16, sweep: 0.12 });
    noise(ctx, out, t, { filter: 'highpass', from: 3500, peak: 0.07, attack: 0.002, decay: 0.03 });
    return 0.25;
  },
  /** The last ten seconds. */
  tick(ctx, out, t) {
    tone(ctx, out, t, { type: 'square', from: 2300, peak: 0.11, decay: 0.03, attack: 0.002 });
    return 0.08;
  },
  /** The last three seconds. */
  tickUrgent(ctx, out, t) {
    tone(ctx, out, t, { type: 'square', from: 3000, peak: 0.16, decay: 0.035, attack: 0.002 });
    tone(ctx, out, t + 0.09, { type: 'square', from: 3000, peak: 0.16, decay: 0.035, attack: 0.002 });
    return 0.2;
  },
  /** The game starts. */
  boom(ctx, out, t) {
    tone(ctx, out, t, { from: 95, to: 34, peak: 0.42, decay: 0.55, sweep: 0.4 });
    noise(ctx, out, t, { filter: 'lowpass', from: 1800, to: 120, peak: 0.2, attack: 0.004, decay: 0.3 });
    return 0.75;
  },
  /** Points for you: a rising arpeggio ending on a bell. */
  win(ctx, out, t) {
    [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) => tone(ctx, out, t + i * 0.075, { type: 'triangle', from: f, peak: 0.3, decay: 0.18 }));
    bell(ctx, out, t + 0.3, NOTE.C7, 0.14, 0.9);
    return 1.3;
  },
  /** Points lost: two sagging notes. */
  wrong(ctx, out, t) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    lp.connect(out);
    tone(ctx, lp, t, { type: 'sawtooth', from: 247, to: 196, peak: 0.22, decay: 0.2 });
    tone(ctx, lp, t + 0.16, { type: 'sawtooth', from: 196, to: 131, peak: 0.24, decay: 0.3 });
    return 0.6;
  },
  /** The answers were swapped: a whoosh up and back with two blips. */
  swap(ctx, out, t) {
    noise(ctx, out, t, { filter: 'bandpass', from: 500, to: 3600, q: 1.8, peak: 0.6, attack: 0.1, decay: 0.12 });
    noise(ctx, out, t + 0.2, { filter: 'bandpass', from: 3600, to: 500, q: 1.8, peak: 0.5, attack: 0.04, decay: 0.2 });
    tone(ctx, out, t + 0.12, { from: 880, peak: 0.2, decay: 0.08 });
    tone(ctx, out, t + 0.3, { from: 1175, peak: 0.2, decay: 0.1 });
    return 0.6;
  },
  /** The final result: a short fanfare. */
  fanfare(ctx, out, t) {
    [NOTE.C5, NOTE.E5, NOTE.G5].forEach((f, i) => tone(ctx, out, t + i * 0.14, { type: 'triangle', from: f, peak: 0.19, decay: 0.3 }));
    [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f) => tone(ctx, out, t + 0.46, { type: 'triangle', from: f, peak: 0.1, decay: 0.9, attack: 0.01 }));
    bell(ctx, out, t + 0.5, NOTE.C7, 0.1, 1.1);
    tone(ctx, out, t + 0.46, { from: 131, to: 65, peak: 0.26, decay: 0.5, sweep: 0.3 });
    return 1.7;
  },
};
