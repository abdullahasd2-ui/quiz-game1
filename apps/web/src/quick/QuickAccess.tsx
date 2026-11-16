// «مركز الاختصارات»: one button on every page that opens a side panel with everything the page can do.
// Search, favourites (the player's own shortcut bar, kept on the device), recently used, and keyboard control
// (Ctrl/⌘+K or «/» opens it, arrows move, Enter runs, Esc closes).
//
// Every item runs a real action handed in by the page (no links to pages that do not exist): an item that does
// not apply right now is simply not passed in.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type QaItem = {
  id: string;
  icon: string;
  title: string;
  /** One line under the title. */
  hint?: string;
  /** Extra words the search should match (English names, other spellings). */
  keywords?: string;
  run: () => void;
  /** Keep the panel open after running (toggles such as sound). */
  stay?: boolean;
  /** Small label at the end of the row (a key, «جديد», «مفعّل»…). */
  badge?: string;
};
export type QaSection = { id: string; title: string; items: QaItem[] };

const MAX_RECENT = 5;

/** Loose Arabic match: hamza forms, ة/ه, ى/ي and «ال» do not matter, nor case. */
function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/(^|\s)ال/g, '$1')
    .trim();
}

function load(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
function save(key: string, v: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    // Private mode: favourites just last for this visit.
  }
}

export function QuickAccess({
  site,
  sections,
  header,
  className,
}: {
  /** Which site's favourites and recents (they are kept apart). */
  site: 'game' | 'stream';
  sections: QaSection[];
  /** Shown at the top of the panel (room info, personal stats…). */
  header?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [favs, setFavs] = useState<string[]>(() => load(`jab:qa:fav:${site}`));
  const [recent, setRecent] = useState<string[]>(() => load(`jab:qa:recent:${site}`));
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  // First visit: a small bubble introduces the center (once per device, gone as soon as it is opened).
  const [tip, setTip] = useState(() => {
    try {
      return !localStorage.getItem('jab:qa:seen');
    } catch {
      return false;
    }
  });
  const seen = useCallback(() => {
    setTip(false);
    try {
      localStorage.setItem('jab:qa:seen', '1');
    } catch {
      // Private mode: the tip may show again next visit.
    }
  }, []);
  useEffect(() => {
    if (!tip) return;
    const t = setTimeout(seen, 12_000);
    return () => clearTimeout(t);
  }, [tip, seen]);

  const all = useMemo(() => sections.flatMap((s) => s.items.map((it) => ({ ...it, section: s.title }))), [sections]);
  const byId = useMemo(() => new Map(all.map((it) => [it.id, it])), [all]);

  const shown: { title: string; items: (QaItem & { section: string })[] }[] = useMemo(() => {
    const term = fold(q);
    if (term) {
      const words = term.split(/\s+/);
      const hits = all.filter((it) => {
        const hay = fold(`${it.title} ${it.hint ?? ''} ${it.keywords ?? ''} ${it.section}`);
        return words.every((w) => hay.includes(w));
      });
      return [{ title: hits.length ? `النتائج (${hits.length})` : 'ما لقيت شي بهذا الاسم', items: hits }];
    }
    const out: { title: string; items: (QaItem & { section: string })[] }[] = [];
    const fav = favs.map((id) => byId.get(id)).filter((x): x is QaItem & { section: string } => Boolean(x));
    if (fav.length) out.push({ title: '⭐ المفضلة', items: fav });
    const rec = recent.filter((id) => !favs.includes(id)).map((id) => byId.get(id)).filter((x): x is QaItem & { section: string } => Boolean(x));
    if (rec.length) out.push({ title: '🕘 استخدمتها مؤخرًا', items: rec });
    for (const s of sections) if (s.items.length) out.push({ title: s.title, items: s.items.map((it) => ({ ...it, section: s.title })) });
    return out;
  }, [q, all, byId, favs, recent, sections]);
  const flat = useMemo(() => shown.flatMap((g) => g.items), [shown]);

  const close = useCallback(() => {
    setOpen(false);
    setQ('');
    opener.current?.focus?.();
  }, []);
  const show = useCallback(() => {
    opener.current = document.activeElement as HTMLElement | null;
    setActive(0);
    setOpen(true);
    seen();
  }, [seen]);

  // Ctrl/⌘+K anywhere, or «/» when not typing, opens the panel.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyK') {
        e.preventDefault();
        if (open) close();
        else show();
      } else if (!open && !typing && e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        show();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close, show]);

  useEffect(() => {
    // On a touch screen focusing the search would pop the keyboard over the panel: only with a mouse/keyboard.
    if (open && !matchMedia('(pointer: coarse)').matches) requestAnimationFrame(() => input.current?.focus());
  }, [open]);
  useEffect(() => setActive(0), [q]);
  // Keep the highlighted row in view while moving with the arrows.
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-qa-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function run(it: QaItem) {
    const next = [it.id, ...recent.filter((x) => x !== it.id)].slice(0, MAX_RECENT);
    setRecent(next);
    save(`jab:qa:recent:${site}`, next);
    if (!it.stay) close();
    // After the panel closes, so a scroll or focus lands on the page.
    setTimeout(it.run, it.stay ? 0 : 60);
  }
  function toggleFav(id: string) {
    const next = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id];
    setFavs(next);
    save(`jab:qa:fav:${site}`, next);
  }
  function moveFav(id: string, by: -1 | 1) {
    const i = favs.indexOf(id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= favs.length) return;
    const next = [...favs];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setFavs(next);
    save(`jab:qa:fav:${site}`, next);
  }

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(flat.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      const it = flat[active];
      if (it) {
        e.preventDefault();
        run(it);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  }

  let index = -1;
  return (
    <>
      <button
        type="button"
        onClick={show}
        data-silent
        className={cn(
          'group fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-40 flex items-center gap-2 rounded-full p-1.5 pe-4 text-sm font-black text-white shadow-[0_10px_30px_-8px_rgba(168,85,247,0.7)] transition-transform hover:-translate-y-0.5 active:scale-95',
          'bg-linear-to-l from-q-purple via-[#7c3aed] to-q-cyan',
          className,
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="مركز الاختصارات (Ctrl+K)"
      >
        <span className="relative grid size-9 place-items-center rounded-full bg-black/25 text-lg">
          <span className="absolute inset-0 rounded-full border border-white/30 border-t-transparent motion-safe:animate-orbit" aria-hidden />⚡
        </span>
        <span className="max-sm:sr-only">الاختصارات</span>
      </button>
      {tip && !open && (
        <div role="status" className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-40 w-64 rounded-2xl border border-q-gold/40 bg-q-panel/95 p-3 text-start text-xs leading-relaxed shadow-2xl backdrop-blur motion-safe:animate-pop-in">
          <b className="mb-0.5 block text-sm text-q-gold">⚡ جديد: مركز الاختصارات</b>
          كل أقسام {site === 'stream' ? 'البث' : 'اللعبة'} في مكان واحد: ابحث، وثبّت اللي تستخدمه بـ ⭐.
          <span className="pointer-coarse:hidden"> افتحه من أي مكان بـ Ctrl+K.</span>
          <button type="button" onClick={seen} className="mt-1.5 block text-[11px] font-bold text-white/60 underline-offset-4 hover:text-white hover:underline">
            فهمت
          </button>
          <span aria-hidden className="absolute -bottom-1.5 right-8 size-3 rotate-45 border-r border-b border-q-gold/40 bg-q-panel" />
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[90]" role="dialog" aria-modal aria-label="مركز الاختصارات" dir="rtl">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm motion-safe:animate-fade-up" onClick={close} />
          <aside
            className="q-glass absolute inset-y-2 left-2 flex w-[min(26rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-3xl motion-safe:animate-sheet-in"
            onKeyDown={onListKey}
          >
            <div className="flex items-center gap-2 border-b border-white/8 p-3">
              <span className="text-xl" aria-hidden>
                ⚡
              </span>
              <div className="flex-1">
                <div className="q-display text-xl leading-none text-q-gold">مركز الاختصارات</div>
                <div className="text-[11px] text-white/50">ابحث أو اختر — ⭐ تضيف للمفضلة</div>
              </div>
              <button type="button" onClick={close} className="grid size-8 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white" aria-label="إغلاق">
                ✕
              </button>
            </div>
            <div className="p-3 pb-1">
              <label className="relative block">
                <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-white/40" aria-hidden>
                  🔎
                </span>
                <input
                  ref={input}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="ابحث عن طور، فئة، أداة…"
                  className="q-input ps-9"
                  aria-label="بحث في الاختصارات"
                  aria-controls="qa-list"
                  aria-activedescendant={flat[active] ? `qa-${flat[active]!.id}` : undefined}
                />
              </label>
            </div>
            {header && !q && <div className="px-3 pt-2">{header}</div>}
            <div ref={list} id="qa-list" role="listbox" className="flex-1 space-y-3 overflow-y-auto p-3 pt-2">
              {shown.map((g) => (
                <div key={g.title}>
                  <div className="mb-1 px-1 text-[11px] font-black tracking-wide text-white/45">{g.title}</div>
                  <div className="space-y-1">
                    {g.items.map((it) => {
                      index += 1;
                      const i = index;
                      const fav = favs.includes(it.id);
                      const isFavGroup = g.title.startsWith('⭐');
                      return (
                        <div
                          key={`${g.title}-${it.id}`}
                          id={`qa-${it.id}`}
                          role="option"
                          aria-selected={i === active}
                          data-qa-index={i}
                          onMouseEnter={() => setActive(i)}
                          className={cn(
                            'group/row flex items-center gap-2 rounded-xl border px-2 py-1.5 transition-colors',
                            i === active ? 'border-q-gold/50 bg-q-gold/10' : 'border-transparent hover:bg-white/5',
                          )}
                        >
                          <button type="button" onClick={() => run(it)} className="flex min-w-0 flex-1 items-center gap-2.5 text-start" tabIndex={-1}>
                            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/6 text-lg">{it.icon}</span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-black">{it.title}</span>
                              {it.hint && <span className="block truncate text-[11px] text-white/50">{q ? `${it.section} · ${it.hint}` : it.hint}</span>}
                            </span>
                            {it.badge && <span className="ms-auto shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white/70">{it.badge}</span>}
                          </button>
                          {isFavGroup && (
                            <span className="flex shrink-0 flex-col opacity-0 group-hover/row:opacity-100 focus-within:opacity-100">
                              <button type="button" className="px-1 text-[10px] leading-3 text-white/60 hover:text-white" onClick={() => moveFav(it.id, -1)} aria-label={`حرّك «${it.title}» لفوق`}>
                                ▲
                              </button>
                              <button type="button" className="px-1 text-[10px] leading-3 text-white/60 hover:text-white" onClick={() => moveFav(it.id, 1)} aria-label={`حرّك «${it.title}» لتحت`}>
                                ▼
                              </button>
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleFav(it.id)}
                            className={cn('grid size-7 shrink-0 place-items-center rounded-lg text-sm transition-opacity', fav ? 'text-q-gold' : 'text-white/30 opacity-0 group-hover/row:opacity-100 focus:opacity-100 pointer-coarse:opacity-100')}
                            aria-label={fav ? `شيل «${it.title}» من المفضلة` : `أضف «${it.title}» للمفضلة`}
                            aria-pressed={fav}
                          >
                            {fav ? '★' : '☆'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-white/8 px-3 py-2 text-[10px] text-white/45 pointer-coarse:hidden">
              <span>
                <kbd className="rounded border border-white/20 px-1">Ctrl</kbd>+<kbd className="rounded border border-white/20 px-1">K</kbd> فتح
              </span>
              <span>
                <kbd className="rounded border border-white/20 px-1">↑</kbd> <kbd className="rounded border border-white/20 px-1">↓</kbd> تنقّل
              </span>
              <span>
                <kbd className="rounded border border-white/20 px-1">Enter</kbd> تشغيل
              </span>
              <span>
                <kbd className="rounded border border-white/20 px-1">Esc</kbd> إغلاق
              </span>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

/** Scroll to an element by id and briefly light it up, so the player sees where the shortcut took them. */
export function spotlight(id: string, focus?: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.animate?.(
    [{ boxShadow: '0 0 0 0 rgba(247,201,72,0)' }, { boxShadow: '0 0 0 4px rgba(247,201,72,0.65)' }, { boxShadow: '0 0 0 0 rgba(247,201,72,0)' }],
    { duration: 1200, easing: 'ease-out' },
  );
  if (focus) setTimeout(() => document.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true }), 350);
}
