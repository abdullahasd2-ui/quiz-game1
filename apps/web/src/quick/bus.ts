// Tiny event bus between the shortcuts center and the screens it drives (the home form, the lobby picker…).
// A screen that is not on the page simply is not listening, and the center only offers what applies.
import { useEffect, useRef } from 'react';
import type { Variant, RoomMode } from '@quiz/shared';

export type QaEvents = {
  'home:variant': Variant;
  'home:mode': RoomMode;
  'home:tab': 'create' | 'join';
  'home:how': void;
  'lobby:toggleCategory': number;
  'lobby:invite': void;
};

const target = new EventTarget();

export function emit<K extends keyof QaEvents>(name: K, ...detail: QaEvents[K] extends void ? [] : [QaEvents[K]]) {
  target.dispatchEvent(new CustomEvent(name, { detail: detail[0] }));
}

/** Listen while the component is on the page. */
export function useBus<K extends keyof QaEvents>(name: K, fn: (detail: QaEvents[K]) => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const on = (e: Event) => ref.current((e as CustomEvent<QaEvents[K]>).detail);
    target.addEventListener(name, on);
    return () => target.removeEventListener(name, on);
  }, [name]);
}

/** Categories picked from the shortcuts before a room exists: the lobby picker starts with them. */
const PRE = 'jab:precategories';
export function preselectCategory(id: number): number[] {
  const now = takePreselected(false);
  const next = now.includes(id) ? now : [...now, id];
  try {
    sessionStorage.setItem(PRE, JSON.stringify(next));
  } catch {
    // Private mode: the pick just does not carry over.
  }
  return next;
}
export function takePreselected(clear = true): number[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(PRE) ?? '[]');
    if (clear) sessionStorage.removeItem(PRE);
    return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : [];
  } catch {
    return [];
  }
}
