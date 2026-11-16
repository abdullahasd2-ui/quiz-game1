// Keyboard shortcuts, the help window that lists them, fullscreen and keeping the screen awake.
//
// The shortcuts press the page's own buttons: a button carries `data-hotkey="<name>"` and the key clicks the
// visible, enabled button with that name. So a shortcut does exactly what the button does, and only when the
// button is there (no shortcut for an action that is not offered right now).
import { useEffect, useState, type ReactNode } from 'react';
import { cn } from './utils';

/** Arabic letters a letter key may pick (a button with `data-hotkey="letter:<l>"`). */
const AR_LETTER = /^[ء-ي]$/;

function typing(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/** The button for a shortcut name: visible and enabled; the last one in the page when there are several. */
function target(name: string): HTMLElement | null {
  const all = [...document.querySelectorAll<HTMLElement>(`[data-hotkey="${CSS.escape(name)}"]`)].filter(
    (el) => !(el as HTMLButtonElement).disabled && el.getClientRects().length > 0,
  );
  return all[all.length - 1] ?? null;
}
function press(name: string): boolean {
  const el = target(name);
  if (!el) return false;
  el.click();
  el.animate?.([{ transform: 'scale(0.94)' }, { transform: 'scale(1)' }], { duration: 160 });
  return true;
}

/** Which shortcut a key press means (by the physical key, so it works on the Arabic layout too). */
function nameOf(e: KeyboardEvent): string | null {
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') return 'go';
  const digit = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
  if (digit) return digit[1]!;
  if (e.code === 'Escape') return 'back';
  if (e.code === 'KeyR') return 'random';
  if (e.code === 'KeyM') return 'mute';
  if (e.code === 'KeyS') return 'swap';
  if (e.code === 'KeyA') return 'answer';
  if (e.code === 'KeyD') return 'reverse';
  if (e.code === 'KeyH') return 'hint';
  if (e.code === 'KeyN') return 'next';
  return null;
}

export async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    // Not allowed here (an iPhone browser, an iframe): the button simply does nothing.
  }
}

/** Shortcuts for the whole page. `extra` handles page-specific keys first (return true when handled). */
export function useHotkeys(extra?: (e: KeyboardEvent) => boolean, { fullscreen = true }: { fullscreen?: boolean } = {}) {
  const [help, setHelp] = useState(false);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || typing(e.target)) return;
      if (e.key === '?' || e.key === '؟' || (e.shiftKey && e.code === 'Slash')) {
        e.preventDefault();
        setHelp((h) => !h);
        return;
      }
      if (e.code === 'Escape' && document.querySelector('[data-hotkeys-help]')) {
        setHelp(false);
        return;
      }
      if (extra?.(e)) return e.preventDefault();
      // An Arabic letter picks that letter where a letter grid is shown.
      if (AR_LETTER.test(e.key) && press(`letter:${e.key}`)) return e.preventDefault();
      if (fullscreen && e.code === 'KeyF') {
        e.preventDefault();
        void toggleFullscreen();
        return;
      }
      const name = nameOf(e);
      if (!name) return;
      // Space and Enter keep their normal job on a focused button or link.
      if (name === 'go' && (e.target as HTMLElement | null)?.closest?.('button, a, [role="button"]')) return;
      if (press(name)) e.preventDefault();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [extra, fullscreen]);
  return { help, setHelp };
}

/** The key shown on a button for keyboard users (hidden on touch screens). */
export function Kbd({ k, className }: { k: string; className?: string }) {
  return (
    <kbd
      aria-hidden
      className={cn(
        'pointer-coarse:hidden ms-1.5 inline-flex min-w-5 items-center justify-center rounded-md border border-white/25 bg-black/30 px-1 font-mono text-[10px] leading-4 font-bold text-white/70',
        className,
      )}
    >
      {k}
    </kbd>
  );
}

export type HotkeyRow = [keys: string, what: string];

/** The «⌨️ الاختصارات» window: opened with «؟» (or the button), closed with Esc or a click outside. */
export function HotkeysHelp({ open, onClose, rows, title = 'اختصارات لوحة المفاتيح', fullscreen = true }: { open: boolean; onClose: () => void; rows: HotkeyRow[]; title?: string; fullscreen?: boolean }) {
  if (!open) return null;
  const all: HotkeyRow[] = [...rows, ...(fullscreen ? [['F', 'ملء الشاشة أو الخروج منه'] as HotkeyRow] : []), ['؟', 'فتح هذي النافذة أو إغلاقها']];
  return (
    <div data-hotkeys-help className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal aria-label={title}>
      <div className="w-full max-w-md rounded-2xl border border-q-gold/40 bg-q-panel p-5 shadow-2xl motion-safe:animate-pop-in" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="mb-1 flex items-center justify-between">
          <div className="text-lg font-black text-q-gold">⌨️ {title}</div>
          <button type="button" className="rounded-lg px-2 text-white/60 hover:text-white" onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-white/60">الاختصار يضغط الزر نفسه، فيشتغل بس إذا الزر ظاهر في الشاشة الحين. الحروف الإنجليزية تشتغل حتى لو لوحة المفاتيح على العربي.</p>
        <ul className="space-y-1.5">
          {all.map(([k, what]) => (
            <li key={k + what} className="flex items-center justify-between gap-3 rounded-lg bg-black/20 px-3 py-1.5 text-sm">
              <span className="text-white/85">{what}</span>
              <span className="flex shrink-0 gap-1">
                {k.split(' / ').map((x) => (
                  <kbd key={x} className="rounded-md border border-white/25 bg-black/40 px-1.5 py-0.5 font-mono text-xs font-bold text-white">
                    {x}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Small round buttons for the corner of a page: shortcuts help (keyboard users only) and fullscreen. */
export function CornerTools({ onHelp, className, children, fullscreen = true }: { onHelp?: () => void; className?: string; children?: ReactNode; fullscreen?: boolean }) {
  const [full, setFull] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement);
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const canFull = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;
  const btn = 'flex size-9 items-center justify-center rounded-full border border-q-line bg-q-panel/80 text-base backdrop-blur transition-colors hover:border-q-gold';
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {children}
      {onHelp && (
        <button type="button" className={cn(btn, 'pointer-coarse:hidden')} onClick={onHelp} title="اختصارات لوحة المفاتيح (؟)" aria-label="اختصارات لوحة المفاتيح">
          ⌨️
        </button>
      )}
      {fullscreen && canFull && (
        <button type="button" className={btn} onClick={() => void toggleFullscreen()} title={full ? 'الخروج من ملء الشاشة (F)' : 'ملء الشاشة (F)'} aria-label={full ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'}>
          {full ? '🗗' : '⛶'}
        </button>
      )}
    </div>
  );
}

/** Keeps the screen on while `active` (a phone that dims in the middle of a question loses the round). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let gone = false;
    const take = async () => {
      try {
        if (document.visibilityState === 'visible' && !gone) lock = await navigator.wakeLock.request('screen');
      } catch {
        // Battery saver or no permission: the screen just dims as usual.
      }
    };
    void take();
    // The lock drops when the tab is hidden; take it again when the player comes back.
    const onVis = () => void take();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      gone = true;
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}
