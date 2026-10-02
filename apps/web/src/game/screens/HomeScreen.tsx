import { ROOM_CODE_LENGTH, TEAM_NAME_MAX, type RoomMode, type Variant } from '@quiz/shared';
import { useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { send } from '../connection';
import { Modal } from '../ui';

function Choice({ selected, onClick, icon, title, desc }: { selected: boolean; onClick: () => void; icon: string; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'rounded-2xl border-2 px-4 py-5 text-center transition-all hover:-translate-y-0.5',
        selected ? 'border-q-gold bg-q-gold/7' : 'border-q-line bg-q-panel',
      )}
    >
      <div className="mb-2 text-4xl">{icon}</div>
      <div className="text-[15px] font-black text-q-gold">{title}</div>
      <div className="mt-1 text-[11px] leading-relaxed text-white/50">{desc}</div>
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs text-white/50">{label}</span>
      {children}
    </label>
  );
}

const codeInputClass = 'q-input text-center text-xl font-black tracking-[0.3em] uppercase';

export function HomeScreen({ initialCode }: { initialCode: string }) {
  const [variant, setVariant] = useState<Variant>('swap');
  const [mode, setMode] = useState<RoomMode>('mobile');
  const [createName, setCreateName] = useState('');
  const [joinName, setJoinName] = useState('');
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [howOpen, setHowOpen] = useState(false);

  async function create(e?: FormEvent) {
    e?.preventDefault();
    setBusy('create');
    const res = await send('room:create', { mode, variant, teamName: mode === 'mobile' ? createName.trim() || undefined : undefined });
    setBusy(null);
    if (!res.ok) toast.error(res.error);
  }

  async function join(e: FormEvent) {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length !== ROOM_CODE_LENGTH) return toast.error(`الكود ${ROOM_CODE_LENGTH} أحرف!`);
    setBusy('join');
    const res = await send('room:join', { code: clean, teamName: joinName.trim() || undefined });
    setBusy(null);
    if (!res.ok) toast.error(res.error);
  }

  const joinForm = (
    <form onSubmit={join} className="q-card">
      <h3 className="mb-3.5 text-[15px] font-bold text-q-gold">{mode === 'tv' ? '🎮 انضمام كفريق (الجوال)' : '🔗 الانضمام لغرفة'}</h3>
      <Field label="اسم فريقك">
        <input className="q-input" value={joinName} onChange={(e) => setJoinName(e.target.value)} placeholder="مثال: الصقور" maxLength={TEAM_NAME_MAX} />
      </Field>
      <Field label={mode === 'tv' ? 'كود الغرفة من التلفاز' : 'كود الغرفة'}>
        <input
          className={codeInputClass}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="أدخل الكود"
          maxLength={ROOM_CODE_LENGTH}
          autoCapitalize="characters"
          autoComplete="off"
          dir="ltr"
        />
      </Field>
      <button className="q-btn-gold" disabled={busy !== null}>
        {busy === 'join' ? 'جاري الانضمام...' : mode === 'tv' ? 'انضمام كفريق' : 'انضمام'}
      </button>
    </form>
  );

  return (
    <div className="animate-fade-up">
      <div className="pt-7 pb-4 text-center">
        <h1 className="flex items-center justify-center gap-2.5 text-[40px] font-black">
          <Logo />
          <span className="text-q-purple">جاوب</span>
          <span className="text-[28px]">أو</span>
          <span className="text-q-cyan">بادل</span>
        </h1>
        <p className="mt-1 text-[13px] text-white/50">اختار سراً — جاوب أو بادل نقاط خصمك!</p>
        <button
          type="button"
          onClick={() => setHowOpen(true)}
          className="mt-2.5 rounded-full border-[1.5px] border-white/20 px-5 py-1.5 text-[13px] text-white/60 transition-colors hover:border-q-purple hover:text-q-purple"
        >
          📖 طريقة اللعب
        </button>
      </div>

      <p className="mb-2 text-center text-[13px] text-white/50">اختار نوع اللعبة</p>
      <div className="mb-5 grid grid-cols-2 gap-3.5">
        <Choice selected={variant === 'swap'} onClick={() => setVariant('swap')} icon="🔄" title="جاوب أو بادل" desc="بادل جواب الخصم واسرق نقاطه" />
        <Choice selected={variant === 'flip'} onClick={() => setVariant('flip')} icon="🔀" title="جاوب أو اقلب" desc="اقلب جواب الخصم من صح لغلط أو العكس" />
      </div>

      <p className="mb-2 text-center text-[13px] text-white/50">اختار طريقة اللعب</p>
      <div className="mb-5 grid grid-cols-2 gap-3.5">
        <Choice selected={mode === 'mobile'} onClick={() => setMode('mobile')} icon="📱" title="جوال" desc="جهازين — كل فريق على جهازه" />
        <Choice selected={mode === 'tv'} onClick={() => setMode('tv')} icon="📺" title="تلفاز" desc="3 أجهزة — التلفاز يعرض والفريقين على جوالاتهم" />
      </div>

      {mode === 'mobile' ? (
        <form onSubmit={create} className="q-card">
          <h3 className="mb-3.5 text-[15px] font-bold text-q-gold">🎮 إنشاء غرفة جديدة</h3>
          <Field label="اسم فريقك">
            <input className="q-input" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="مثال: النمور" maxLength={TEAM_NAME_MAX} />
          </Field>
          <button className="q-btn-gold" disabled={busy !== null}>
            {busy === 'create' ? 'جاري الإنشاء...' : 'إنشاء غرفة'}
          </button>
        </form>
      ) : (
        <div className="q-card border-q-purple/40">
          <h3 className="mb-1.5 text-[15px] font-bold text-q-purple">📺 تشغيل على التلفاز (المضيف)</h3>
          <p className="mb-3 text-xs text-white/50">افتح هذا على التلفاز — يتحكم باللعبة ويعرض الأسئلة</p>
          <button type="button" className="q-btn-tv" disabled={busy !== null} onClick={() => create()}>
            {busy === 'create' ? 'جاري الإنشاء...' : 'إنشاء غرفة للتلفاز 📺'}
          </button>
        </div>
      )}
      <div className="my-1.5 text-center text-white/20">—</div>
      {joinForm}

      <HowToPlay open={howOpen} onClose={() => setHowOpen(false)} />
    </div>
  );
}

function Logo() {
  return (
    <svg width="46" height="46" viewBox="0 0 60 60" aria-hidden>
      <circle cx="26" cy="34" r="20" fill="#111" stroke="#333" strokeWidth="2" />
      <circle cx="19" cy="26" r="4" fill="rgba(255,255,255,0.1)" />
      <rect x="23" y="13" width="6" height="6" rx="2" fill="#222" stroke="#444" strokeWidth="1.5" />
      <path d="M38 18 Q43 12 48 8" stroke="#888" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="48" cy="8" r="4" fill="#ff6b35" />
      <circle cx="51" cy="5" r="3" fill="#f7c948" />
      <circle cx="49" cy="3" r="2" fill="#fff" />
    </svg>
  );
}

function HowSection({ tone, title, children }: { tone: string; title: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-xl border p-3', tone)}>
      <div className="mb-1.5 font-black">{title}</div>
      {children}
    </div>
  );
}

function HowToPlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[17px] font-black text-q-purple">📖 طريقة اللعب</h2>
        <button type="button" onClick={onClose} className="text-xl text-white/50" aria-label="إغلاق">
          ✕
        </button>
      </div>
      <div className="grid gap-2.5 text-start text-[13px] leading-loose text-white/80">
        <HowSection tone="border-q-purple/30 bg-q-purple/10 [&>div:first-child]:text-q-purple" title="📱 وضع الجوال (جهازين)">
          <div>• جهاز ينشئ غرفة والثاني ينضم بالكود</div>
          <div>• الفريق الذي دوره يختار من اللوحة</div>
          <div>• كلاهم يختار سراً جاوب أو بادل ثم يجاوبون</div>
        </HowSection>
        <HowSection tone="border-q-cyan/30 bg-q-cyan/10 [&>div:first-child]:text-q-cyan" title="📺 وضع التلفاز (3 أجهزة)">
          <div>• التلفاز: ينشئ الغرفة ويختار الأسئلة ويعرض النتائج</div>
          <div>• الفريق 1 و2: ينضمون بالكود ويجاوبون على جوالاتهم</div>
        </HowSection>
        <HowSection tone="border-q-gold/25 bg-q-gold/8 [&>div:first-child]:text-q-gold" title="🏆 نظام النقاط — جاوب أو بادل">
          <div>✅ جاوب صح = نقاط السؤال</div>
          <div>
            🔄 بادل + خصمك صح = <span className="text-q-gold">ضعف النقاط!</span>
          </div>
          <div>
            🔄 بادل + خصمك غلط = <span className="text-q-red">عقوبة</span>
          </div>
          <div>🔄🔄 كلاهم بادل = لا نقاط</div>
        </HowSection>
        <HowSection tone="border-q-gold/25 bg-q-gold/8 [&>div:first-child]:text-q-gold" title="🔀 نظام النقاط — جاوب أو اقلب">
          <div>✅ جاوب صح = نقاط السؤال</div>
          <div>🔀 اقلب: إذا كان جواب الخصم صح يصير غلط، وإذا كان غلط يصير صح!</div>
          <div>🔀🔀 كلاهم اقلب = لا نقاط لأحد</div>
        </HowSection>
      </div>
      <button type="button" onClick={onClose} className="q-btn-tv mt-3.5">
        فهمت! 🚀
      </button>
    </Modal>
  );
}
