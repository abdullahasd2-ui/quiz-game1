import { displayName, type StreamState } from '@quiz/shared';

/**
 * «جاوب أو بادل أو اعكس»: the result told in words, with the reason for every swap/reverse —
 * who reversed whom, why someone got nothing (انزرف), and why the streamer and his partner both got zero.
 * `you` speaks to the streamer (control page); otherwise it speaks about him (broadcast screen).
 */
export function tripleLines(state: StreamState, you: boolean): { text: string; tone: 'good' | 'bad' | 'gold' | 'dim' }[] {
  const r = state.round;
  const res = state.result;
  if (!r || !res) return [];
  const P = r.question.points;
  const st = r.streamer;
  const he = you ? 'أنت' : 'الستريمر';
  const name = (k: string | null) => (k ? displayName(state, k) : '');
  const partner = st?.partner ?? null;
  const pc = partner ? r.choices[partner] : undefined;
  const mutual = partner !== null && pc !== undefined && pc !== 'answer';
  const chat = Object.entries(r.choices).filter(([k]) => k !== partner);
  const swappers = chat.filter(([, c]) => c === 'swap').length;
  const reversers = chat.filter(([, c]) => c === 'reverse').length;
  const out: ReturnType<typeof tripleLines> = [];
  const did = (c: string | undefined) => (c === 'reverse' ? 'عكس على' : 'بادل مع');

  if (mutual) {
    out.push({ text: `🤝 ${he} ${did(st?.choice)} ${name(partner)}، و${name(partner)} ${you ? (pc === 'reverse' ? 'عكس عليك' : 'بادل معك') : `${did(pc)} الستريمر`} — اختاروا بعض، الاثنين صفر`, tone: 'gold' });
  } else if (st?.choice === 'reverse') {
    const p = partner ? r.picks[partner] : undefined;
    if (p === undefined) out.push({ text: `↩️ ${he} عكس على ${name(partner)} — وما جاوب، فما فيه نقاط`, tone: 'dim' });
    else if (p === res.correctIndex) out.push({ text: `↩️ ${he} عكس على ${name(partner)} — جاوب صح، فنقص من ${you ? 'ك' : 'الستريمر'} ${P}`, tone: 'bad' });
    else out.push({ text: `↩️ ${he} عكس على ${name(partner)} — جاوب غلط، فزاد ${you ? 'لك' : 'للستريمر'} ${P}`, tone: 'good' });
  } else if (st?.choice === 'swap') {
    out.push(
      res.streamerCorrect
        ? { text: `🔄 ${he} بادل مع ${name(partner)} — جاوب صح: دبل ${you ? 'لك' : 'للستريمر'} (${P * 2})، و${name(partner)} انزرف 😵 ما ياخذ شي`, tone: 'good' }
        : { text: `🔄 ${he} بادل مع ${name(partner)} — ${res.streamerPick === null ? 'ما جاوب' : 'جاوب غلط'}: ينقص ${you ? 'منك' : 'من الستريمر'} ${P}`, tone: 'bad' },
    );
  } else {
    out.push({ text: `${he} جاوب — ${res.streamerPick === null ? '⏱ بدون جواب' : res.streamerCorrect ? '✅ صح' : '❌ غلط'}`, tone: res.streamerCorrect ? 'good' : 'bad' });
    if (res.streamerCorrect && swappers) out.push({ text: `😵 ${you ? 'انزرفت' : 'الستريمر انزرف'}! ${swappers} بادلوا ${you ? 'معك' : 'معه'} وأخذوا دبل النقاط — ${you ? 'ما لك' : 'ما له'} شي`, tone: 'gold' });
  }

  const target = !mutual && st?.choice !== 'reverse';
  if (!target && (swappers || reversers)) {
    out.push({ text: `🚫 ${swappers + reversers} بادلوا أو عكسوا على الستريمر — بس هو ما جاوب بنفسه، فما لهم شي`, tone: 'dim' });
  } else if (target) {
    if (swappers && !res.streamerCorrect) out.push({ text: `🔄 ${swappers} بادلوا ${you ? 'معك' : 'مع الستريمر'} — جوابه غلط، نقص منهم ${P}`, tone: 'dim' });
    if (reversers)
      out.push(
        res.streamerCorrect
          ? { text: `↩️ ${reversers} عكسوا على الستريمر — جوابه صح، فنقص منهم ${P}`, tone: 'dim' }
          : { text: `↩️ ${reversers} عكسوا على الستريمر — جوابه غلط، فزاد لهم ${P}`, tone: 'dim' },
      );
  }
  return out;
}

export const toneClass = { good: 'text-q-green', bad: 'text-q-red', gold: 'text-q-gold', dim: 'text-white/75' } as const;
