// «عدّها» questions, built from the data lists: each question is a prompt plus every accepted answer.
// Built once at startup; the stream page asks for one question at a time (/api/kick/lists/next).
import { COUNTRIES } from './data/countries';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listFold } from '@quiz/shared';
import { CITIES, US_STATES, SA_REGIONS, RIVERS, MOUNTAINS, SEAS, LANDMARKS } from './data/places';
import { CLUBS, LEAGUES } from './data/clubs';
import { PLAYERS, NATIONS } from './data/players';
import { PLAYERS2 } from './data/players2';
import { GAMES, GAME_CHARACTERS } from './data/games';
import { ANIMALS, LISTS } from './data/general';
import { EXTRA } from './data/extra';
import { ISLAMIC } from './data/islamic';
import { PROVERBS } from './data/proverbs';

export type ListCategory = 'football' | 'geo' | 'general' | 'games' | 'islamic' | 'proverbs' | 'letters';
export type ListLevel = 'easy' | 'medium' | 'hard';
export type ListQuestion = { id: string; cat: ListCategory; text: string; answers: string[]; letter?: string; level: ListLevel };
export const LIST_LEVELS: { id: ListLevel; name: string; icon: string }[] = [
  { id: 'easy', name: 'سهل', icon: '🟢' },
  { id: 'medium', name: 'متوسط', icon: '🟡' },
];

/** Lists that are long but that few people can name much from (lakes, volcanoes…): never «سهل». */
const ARABS = 'sa|ae|kw|qa|bh|om|ye|iq|sy|jo|lb|ps|eg|sd|ly|tn|dz|ma|mr';
/**
 * The game is for Saudi, Gulf and Arab players: lists few of them could name much from are left out of «عدّها»
 * (far-away cities, lakes and volcanoes, foreign actors and singers…). Arab countries, Turkey (its series) and the
 * big football and entertainment names stay.
 */
const OFF_AUDIENCE = new RegExp(
  '^(' +
    [
      `geo-cities-(?!(${ARABS}|us|uk|fr|tr|es|it|de)(-|$))`,
      'ex-(lakes|volcanoes|islands|deserts|airlines|watches|scientists|painters|writers|elements|dogs|languages|battles|wars|waterfalls)',
      'geo-(mountains|rivers|sights|us-states|lang-|sea-(carib|black|caspian))',
      `ex-p(actors|singers|series|writers)-(?!(${ARABS}|tr|us)(-|$))`,
      `ex-pfilms-(?!(${ARABS}|tr|us|in)(-|$))`,
      `ex-pmosques-(?!(${ARABS}|tr)(-|$))`,
      `fb-nat-(?!(${ARABS}|br|ar|fr|es|pt|de|it|en|nl|be|hr|uy|sn|ci|ng|cm)(-|$))`,
      'gm-co-(bandai|konami|square|capcom)',
      'gm-genre-(moba|sandbox|survival|puzzle)',
      'gm-chars-(tekken|mk)',
    ].join('|') +
    ')',
);
/** Nothing about Iran. */
const IRAN = /(^|-)ir(-|$)|إيران|ايران|طهران/;
/** Saudi, Gulf and Arab questions come up more often (see listWeight). */
const HOME = new RegExp(`(^|-)(${ARABS})(-|$)|arab|gcc|gulf|saTeams|saudi|geo-sa-|fb-league-sa|fb-clubs-arab|is-|pv-`);

/** How likely a question is to be picked: Saudi / Gulf / Arab topics three times, easy ones twice. */
export function listWeight(q: { id: string; level: ListLevel }): number {
  return (HOME.test(q.id) ? 3 : 1) * (q.level === 'easy' ? 2 : 1);
}
/** A random question from `pool`, by listWeight. */
export function weightedPick<T extends { id: string; level: ListLevel }>(pool: T[]): T | undefined {
  let r = Math.random() * pool.reduce((n, q) => n + listWeight(q), 0);
  for (const q of pool) if ((r -= listWeight(q)) < 0) return q;
  return pool[pool.length - 1];
}

const NICHE = /^(geo-cities-(cn|in|br|ru|mx|ca|au|ar|ir|pk|id|ly|sd|sy|iq|dz|jo|tn|lb|om|bh|kw|qa|jp|be|ch|at|pl|gr|se|no|ua|ro|kr|th|vn|ph|my|af|ng|za|ke|et|co|pe|cl|ve|ps|mr)|ex-lakes|ex-volcanoes|ex-islands|geo-mountains|geo-rivers|ex-deserts|gm-co-|gm-all|is-mosques|is-imams|is-readers|ex-airlines|ex-watches|ex-famousArabs|ex-scientists|ex-actors|ex-(medications|minerals|constellations|moons|horses|cats|tribes|jurists|dynasties|arpapers|caves|waterfalls|bridges|palaces|castles|histcountries|composers|philosophers|battles|wuni|aruni))/;
/** Lists everyone can name a lot from: always «سهل» when long enough. */
const EVERYDAY = /^(gn-(animals|fruits|vegetables|fruitveg|colors|jobs|foods|desserts|drinks|bodyParts|clothes|home|kitchen|boys|girls|sports|carBrands|apps|months)|geo-(countries|capitals|arab|cities-sa)|ex-(supermarket|school|emotions|shapes|weather)|fb-all|fb-pos-|fb-league-(es|en|sa)$|fb-club-(rma|bar|hil|nas)$|is-(names|pillars|prayers|hijriMonths|zikr)|pv-all|gn-surahs$|gn-prophets$)/;

/**
 * How hard a question is, from how much there is to name and how everyday the subject is:
 * «سهل» = lots of answers most people know, «صعب» = few answers or a specialist subject.
 */
function levelOf(q: Omit<ListQuestion, 'level'>): ListLevel {
  const n = q.answers.length;
  if (q.letter) return n >= 25 && !NICHE.test(q.id) ? 'easy' : n >= 10 ? 'medium' : 'hard';
  if (EVERYDAY.test(q.id) && n >= 12) return 'easy';
  if (NICHE.test(q.id)) return n >= 60 ? 'medium' : 'hard';
  return n >= 40 ? 'easy' : n >= 12 ? 'medium' : 'hard';
}

export const LIST_CATEGORIES: { id: ListCategory; name: string; icon: string }[] = [
  { id: 'football', name: 'كورة', icon: '⚽' },
  { id: 'geo', name: 'جغرافيا', icon: '🌍' },
  { id: 'general', name: 'عامة', icon: '💡' },
  { id: 'games', name: 'ألعاب فيديو', icon: '🎮' },
  { id: 'islamic', name: 'إسلاميات', icon: '🕌' },
  { id: 'proverbs', name: 'أمثال', icon: '📜' },
  // «حروف»: no questions of its own, it is every letter question of the other categories (pick a letter, get a question for it).
  { id: 'letters', name: 'حروف', icon: '🔤' },
];

const LETTERS = 'ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي'.split(' ');
export const LIST_LETTERS = LETTERS;
/** First letters of an answer's Arabic forms («ميسي» and «ليونيل ميسي»), «ال» and hamza forms aside. */
function letters(a: string): Set<string> {
  const out = new Set<string>();
  for (let w of a.split('|')) {
    w = w.trim();
    if (!/^[\u0600-\u06FF]/.test(w)) continue;
    if (w.startsWith('ال') && w.length > 3) w = w.slice(2);
    const c = w[0] ?? '';
    out.add(/[أإآٱ]/.test(c) ? 'ا' : c === 'ى' ? 'ي' : c);
  }
  return out;
}
/** Names that begin with what they are («مسجد…», «جامعة…», «معركة…»): their first letter says nothing, so letter questions skip them. */
const GENERIC = /^(ال)?(مسجد|جامع|جامعة|مطار|نهر|جبل|جبال|بحيرة|جزيرة|جزر|بركان|قلعة|قصر|متحف|برج|شلال|شلالات|معركة|موقعة|غزوة|سرية|حرب|الحرب|حصار|الدولة|دولة|سلالة|كلب|قط|مدينة|ملعب|سلسلة|كهف|مغارة|إمبراطورية|الإمبراطورية|مملكة|المملكة|سلطنة|إمارة|جمهورية|الجمهورية|صحيفة|جريدة|شركة|فرس|خيول)\s/;
/** Merge forms of the same answer that came from different lists, keep order, drop exact repeats. */
/** listFold, remembered: the same names come up in many lists (a player is in his clubs, leagues, letters…). */
const foldCache = new Map<string, string>();
function fold(s: string): string {
  let v = foldCache.get(s);
  if (v === undefined) foldCache.set(s, (v = listFold(s)));
  return v;
}

function uniq(items: string[]): string[] {
  // The same answer from two lists («النيل» and «نهر النيل|Nile») is one answer: merged when any written form matches.
  const seen = new Map<string, number>();
  const out: string[] = [];
  for (const it of items) {
    const forms = it.split('|').map((f) => f.trim()).filter(Boolean);
    const keys = forms.map(fold).filter((k) => k.length >= 2);
    const hit = keys.map((k) => seen.get(k)).find((i) => i !== undefined);
    if (hit !== undefined) {
      out[hit] = [...new Set([...out[hit]!.split('|'), ...forms])].join('|');
      for (const k of keys) if (!seen.has(k)) seen.set(k, hit);
    } else if (forms.length) {
      for (const k of keys) seen.set(k, out.length);
      out.push(forms.join('|'));
    }
  }
  return out;
}

// ---------- Wikidata lists (built once with SPARQL; see wd/*.json) ----------
const WD_DIR = join(dirname(fileURLToPath(import.meta.url)), 'wd');
/** Rows of one Wikidata list: «عربي|أسماء ثانية|English», plus the group it was asked for (publisher…). */
function wd(name: string): { a: string; g?: string }[] {
  try {
    return (JSON.parse(readFileSync(join(WD_DIR, `${name}.json`), 'utf8')) as { a: string; g?: string }[]).map((r) => ({ ...r, a: withShort(r.a) }));
  } catch {
    return [];
  }
}
const PREFIXES = ['نهر ', 'جبل ', 'جبال ', 'بحيرة ', 'جزيرة ', 'جزر ', 'بركان ', 'مسجد ', 'جامع ', 'مدينة '];
/** Adds the short form people actually type: «نهر النيل» → «النيل», «Lake Victoria» → «Victoria». */
function withShort(a: string): string {
  const forms = trustworthy(a.split('|'));
  for (const f of [...forms]) {
    for (const p of PREFIXES) if (f.startsWith(p) && f.length - p.length >= 3) forms.push(f.slice(p.length));
    const en = f.replace(/^(Lake|Mount|Mt\.?) /, '').replace(/ (River|Island|Lake|Mountain|Volcano)$/, '');
    if (en !== f && en.length >= 3) forms.push(en);
  }
  return [...new Set(forms)].join('|');
}
/**
 * Wikidata's other names are typed by anyone and some are wrong (a Chinese city «الخنساء»): an Arabic other name is kept
 * only when it looks like the main name (shares its first two letters or most of its letters). English stays as is.
 */
function trustworthy(forms: string[]): string[] {
  const [main, ...rest] = forms;
  if (!main) return forms;
  const m = listFold(main);
  return [main, ...rest.filter((f) => {
    if (!/[\u0600-\u06FF]/.test(f)) return true;
    const k = listFold(f);
    if (k.slice(0, 2) === m.slice(0, 2) || k.includes(m) || m.includes(k)) return true;
    const shared = [...new Set(k)].filter((c) => m.includes(c)).length;
    return shared / Math.max(new Set(k).size, 1) >= 0.7;
  })];
}
const wdItems = (name: string) => wd(name).map((r) => r.a);
/** More Wikidata lists (wd/<key>.json), each a question of its own plus its letter questions. */
const WD_EXTRA: Record<string, [Exclude<ListCategory, 'proverbs' | 'letters'>, string]> = {
  elements: ['general', 'اذكر عناصر كيميائية'],
  dogs: ['general', 'اذكر سلالات كلاب'],
  painters: ['general', 'اذكر رسامين مشهورين'],
  wactors: ['general', 'اذكر ممثلين وممثلات عالميين'],
  wsingers: ['general', 'اذكر مغنين ومغنيات عالميين'],
  writers: ['general', 'اذكر كتّاب وأدباء مشهورين'],
  uspres: ['general', 'اذكر رؤساء الولايات المتحدة'],
  films: ['general', 'اذكر أفلام عالمية مشهورة'],
  egfilms: ['general', 'اذكر أفلام مصرية'],
  arseries: ['general', 'اذكر مسلسلات عربية'],
  wseries: ['general', 'اذكر مسلسلات أجنبية'],
  carmodels: ['general', 'اذكر موديلات سيارات (أي ماركة)'],
  companies: ['general', 'اذكر شركات عالمية'],
  wars: ['general', 'اذكر حروبًا مشهورة'],
  battles: ['general', 'اذكر معارك تاريخية'],
  aruni: ['geo', 'اذكر جامعات عربية'],
  skyscrapers: ['geo', 'اذكر أبراجًا وناطحات سحاب'],
  waterfalls: ['geo', 'اذكر شلالات'],
  gseries: ['games', 'اذكر سلاسل ألعاب فيديو'],
};
const ADJ_M: Record<string, string> = {
  sa: 'سعوديين', eg: 'مصريين', ma: 'مغاربة', dz: 'جزائريين', tn: 'تونسيين', iq: 'عراقيين', qa: 'قطريين', ae: 'إماراتيين', kw: 'كويتيين', jo: 'أردنيين', sy: 'سوريين', lb: 'لبنانيين',
  om: 'عمانيين', bh: 'بحرينيين', ly: 'ليبيين', sd: 'سودانيين', ps: 'فلسطينيين', ye: 'يمنيين', us: 'أمريكيين', gb: 'بريطانيين', fr: 'فرنسيين', it: 'إيطاليين', tr: 'أتراك',
  in: 'هنود', kr: 'كوريين', es: 'إسبان', de: 'ألمان', br: 'برازيليين', mx: 'مكسيكيين',
};
const ADJ_F: Record<string, string> = {
  sa: 'سعودية', eg: 'مصرية', ma: 'مغربية', dz: 'جزائرية', tn: 'تونسية', sy: 'سورية', lb: 'لبنانية', kw: 'كويتية', us: 'أمريكية', gb: 'بريطانية', fr: 'فرنسية',
  it: 'إيطالية', tr: 'تركية', in: 'هندية', kr: 'كورية', es: 'إسبانية', mx: 'مكسيكية',
};
const MOSQUE_IN: Record<string, string> = {
  sa: 'السعودية', eg: 'مصر', ma: 'المغرب', dz: 'الجزائر', tn: 'تونس', iq: 'العراق', sy: 'سوريا', lb: 'لبنان', ly: 'ليبيا', ps: 'فلسطين', ye: 'اليمن', ae: 'الإمارات', jo: 'الأردن', om: 'عمان',
  tr: 'تركيا', ir: 'إيران', in: 'الهند', pk: 'باكستان', id: 'إندونيسيا', my: 'ماليزيا', es: 'إسبانيا (الأندلس)', uz: 'أوزبكستان', af: 'أفغانستان',
};
const GENRE: Record<string, string> = {
  'g-platform': 'منصات (بلاتفورمر)', 'g-fps': 'تصويب منظور الشخص الأول (FPS)', 'g-rpg': 'تقمص أدوار (RPG)', 'g-racing': 'سباقات',
  'g-puzzle': 'ألغاز', 'g-fighting': 'قتال', 'g-horror': 'رعب', 'g-football': 'كرة قدم', 'g-sports': 'رياضية',
};
/** Wikidata lists split by country (wd/<key>.json rows carry the country in `g`): one question per country. */
const WD_GROUPED: Record<string, [Exclude<ListCategory, 'proverbs' | 'letters'>, (g: string) => string | undefined]> = {
  pactors: ['general', (g) => ADJ_M[g] && `اذكر ممثلين وممثلات ${ADJ_M[g]}`],
  psingers: ['general', (g) => ADJ_M[g] && `اذكر مطربين ومطربات ${ADJ_M[g]}`],
  pwriters: ['general', (g) => ADJ_M[g] && `اذكر كتّاب وشعراء ${ADJ_M[g]}`],
  pseries: ['general', (g) => ADJ_F[g] && `اذكر مسلسلات ${ADJ_F[g]}`],
  pfilms: ['general', (g) => ADJ_F[g] && `اذكر أفلام ${ADJ_F[g]}`],
  pmosques: ['islamic', (g) => MOSQUE_IN[g] && `اذكر مساجد في ${MOSQUE_IN[g]}`],
  ggenres: ['games', (g) => GENRE[g] && `اذكر ألعاب ${GENRE[g]}`],
};
/** Squad players of the big clubs from Wikidata (wd/players.json): «اسم|English», nationality, position, club ids. */
function wdPlayers(): [string, string, string, string][] {
  try {
    const rows = JSON.parse(readFileSync(join(WD_DIR, 'players.json'), 'utf8')) as { a: string; n: string; p: string; c: string }[];
    return rows.map((r) => [r.a, r.n, r.p, r.c]);
  } catch {
    return [];
  }
}

const CITY_LABELS: Record<string, string> = {
  cn: 'الصين', in: 'الهند', br: 'البرازيل', ru: 'روسيا', iq: 'العراق', dz: 'الجزائر', mx: 'المكسيك', ca: 'كندا', au: 'أستراليا', ar: 'الأرجنتين',
  sy: 'سوريا', ir: 'إيران', pk: 'باكستان', jo: 'الأردن', ly: 'ليبيا', sd: 'السودان', lb: 'لبنان', om: 'عمان', bh: 'البحرين', tn: 'تونس', kw: 'الكويت', qa: 'قطر', id: 'إندونيسيا', ye: 'اليمن',
};
/** Game publishers as named on Wikidata → our company keys. */
const PUBLISHER: Record<string, string> = {
  Nintendo: 'nintendo', 'Nintendo of America': 'nintendo', 'The Pokémon Company': 'nintendo', 'Sony Interactive Entertainment': 'sony', 'Sony Computer Entertainment': 'sony',
  'Electronic Arts': 'ea', 'EA Sports': 'ea', Konami: 'konami', Capcom: 'capcom', 'Square Enix': 'square', Square: 'square', Enix: 'square', 'Bandai Namco Entertainment': 'bandai',
  Namco: 'bandai', Bandai: 'bandai', 'Xbox Game Studios': 'ms', 'Microsoft Studios': 'ms', 'Warner Bros. Games': 'wb', 'Bethesda Softworks': 'bethesda', '2K': '2k', 'Valve Corporation': 'valve',
  FromSoftware: 'fromsoft', Ubisoft: 'ubisoft', Activision: 'activision', 'Activision Blizzard': 'activision', Sega: 'sega', 'Rockstar Games': 'rockstar', 'Blizzard Entertainment': 'blizzard', 'Epic Games': 'epic', 'Riot Games': 'riot',
};
let augmented = false;
/** Once: the Wikidata lists join the hand-written ones (same answer merged). */
function augment() {
  if (augmented) return;
  augmented = true;
  for (const [k, v] of Object.entries(CITIES)) v.items.push(...wdItems(`city-${k}`));
  for (const [k, label] of Object.entries(CITY_LABELS)) {
    const items = wdItems(`city-${k}`);
    if (items.length >= 8) CITIES[k] = { label, items };
  }
  RIVERS.push(...wdItems('rivers'));
  MOUNTAINS.push(...wdItems('mountains'));
  LISTS.carBrands!.items.push(...wdItems('carbrands'));
  LISTS.foods!.items.push(...wdItems('dishes'));
  LISTS.sports!.items.push(...wdItems('sports'));
  LISTS.instruments!.items.push(...wdItems('instruments'));
  LISTS.superheroes!.items.push(...wdItems('marvel'));
  EXTRA.airlines!.items.push(...wdItems('airlines'));
  EXTRA.languages!.items.push(...wdItems('languages'));
  EXTRA.islands!.items.push(...wdItems('islands'));
  ISLAMIC.mosques!.items.push(...wdItems('mosques'));
  EXTRA.lakes = { cat: 'geo', text: 'اذكر بحيرات', items: wdItems('lakes') };
  EXTRA.volcanoes = { cat: 'geo', text: 'اذكر براكين', items: wdItems('volcanoes') };
  EXTRA.famousArabs!.items.push(...wdItems('poets'));
  EXTRA.singers = { cat: 'general', text: 'اذكر مطربين ومطربات عرب', items: wdItems('singers') };
  EXTRA.actors = { cat: 'general', text: 'اذكر ممثلين وممثلات عرب', items: wdItems('actors') };
  EXTRA.scientists!.items.push(...wdItems('scientists'));
  for (const [k, [cat, text]] of Object.entries(WD_EXTRA)) {
    const items = wdItems(k);
    if (items.length) EXTRA[k] = { cat, text, items };
  }
  for (const [k, [cat, title]] of Object.entries(WD_GROUPED)) {
    const groups = new Map<string, string[]>();
    for (const r of wd(k)) if (r.g) groups.set(r.g, [...(groups.get(r.g) ?? []), r.a]);
    for (const [g, items] of groups) {
      const text = title(g);
      if (text && items.length >= 6) EXTRA[`${k}-${g}`] = { cat, text, items };
    }
  }
  for (const r of [...wd('games_pub'), ...wd('games_dev')]) {
    const co = r.g ? PUBLISHER[r.g] : undefined;
    GAMES.push([r.a, co ?? '']);
  }
}

/** No anime and no Pokémon anywhere, also not as a game or a cartoon answer. */
const NO_ANIME = /بوكيمون|بيكاتشو|pok[eé]mon|pikachu|أنمي|انمي|anime/i;

export function buildBank(): ListQuestion[] {
  const qs: Omit<ListQuestion, 'level'>[] = [];
  augment();
  const add = (id: string, cat: ListCategory, text: string, answers: string[], min = 5, letter?: string) => {
    const a = uniq(answers.filter((x) => x && !NO_ANIME.test(x)));
    if (a.length >= min) qs.push({ id, cat, text, answers: a, ...(letter ? { letter } : {}) });
  };
  const byLetter = (id: string, cat: ListCategory, what: string, items: string[], min = 6) => {
    // Only the Arabic forms that really start with the letter are accepted («ميسي» for م, not «ليونيل ميسي» or «Messi»).
    // Each answer is sorted into its letters once (skipping «مسجد…»-style names, as before; 28 times faster than checking every letter).
    const buckets = new Map<string, string[]>();
    for (const a of items) {
      const per = new Map<string, string[]>();
      for (const f of a.split('|')) {
        if (GENERIC.test(f.trim())) continue;
        for (const l of letters(f)) (per.get(l) ?? per.set(l, []).get(l)!).push(f);
      }
      for (const [l, fs] of per) (buckets.get(l) ?? buckets.set(l, []).get(l)!).push(fs.join('|'));
    }
    for (const l of LETTERS) add(`${id}-${l}`, cat, `اذكر ${what} تبدأ بحرف «${l}»`, buckets.get(l) ?? [], min, l);
  };

  // ---------- Geography ----------
  const CONT: Record<string, string> = { af: 'أفريقيا', as: 'آسيا', eu: 'أوروبا', na: 'أمريكا الشمالية والوسطى', sa: 'أمريكا الجنوبية', oc: 'أوقيانوسيا' };
  add('geo-countries', 'geo', 'اذكر دول العالم', COUNTRIES.map((c) => c[0]));
  add('geo-capitals', 'geo', 'اذكر عواصم دول العالم', COUNTRIES.map((c) => c[1]));
  for (const [k, n] of Object.entries(CONT)) {
    add(`geo-cont-${k}`, 'geo', `اذكر دول في ${n}`, COUNTRIES.filter((c) => c[2] === k).map((c) => c[0]));
    add(`geo-cap-${k}`, 'geo', `اذكر عواصم دول ${n}`, COUNTRIES.filter((c) => c[2] === k).map((c) => c[1]));
    byLetter(`geo-cont-${k}`, 'geo', `دول في ${n}`, COUNTRIES.filter((c) => c[2] === k).map((c) => c[0]), 4);
  }
  const arab = COUNTRIES.filter((c) => c[3].split(',').includes('ar'));
  add('geo-arab', 'geo', 'اذكر الدول العربية', arab.map((c) => c[0]));
  add('geo-arab-cap', 'geo', 'اذكر عواصم الدول العربية', arab.map((c) => c[1]));
  add('geo-arab-af', 'geo', 'اذكر دول عربية في أفريقيا', arab.filter((c) => c[2] === 'af').map((c) => c[0]));
  add('geo-arab-as', 'geo', 'اذكر دول عربية في آسيا', arab.filter((c) => c[2] === 'as').map((c) => c[0]));
  const LANG: Record<string, string> = { en: 'الإنجليزية', fr: 'الفرنسية', es: 'الإسبانية', pt: 'البرتغالية', de: 'الألمانية', ru: 'الروسية' };
  for (const [k, n] of Object.entries(LANG)) add(`geo-lang-${k}`, 'geo', `اذكر دول من لغاتها الرسمية ${n}`, COUNTRIES.filter((c) => c[3].split(',').includes(k)).map((c) => c[0]), 4);
  const SEA: Record<string, string> = { med: 'البحر المتوسط', red: 'البحر الأحمر', gulf: 'الخليج العربي', atl: 'المحيط الأطلسي', pac: 'المحيط الهادئ', ind: 'المحيط الهندي', carib: 'البحر الكاريبي', black: 'البحر الأسود', caspian: 'بحر قزوين' };
  for (const [k, n] of Object.entries(SEA)) add(`geo-sea-${k}`, 'geo', `اذكر دول تطل على ${n}`, COUNTRIES.filter((c) => c[4].split(',').includes(k)).map((c) => c[0]), 4);
  byLetter('geo-countries', 'geo', 'دول', COUNTRIES.map((c) => c[0]), 4);
  byLetter('geo-capitals', 'geo', 'عواصم', COUNTRIES.map((c) => c[1]), 4);
  for (const [k, v] of Object.entries(CITIES)) add(`geo-cities-${k}`, 'geo', `اذكر مدن في ${v.label}`, v.items);
  const allCities = Object.values(CITIES).flatMap((v) => v.items).concat(COUNTRIES.map((c) => c[1]));
  add('geo-cities', 'geo', 'اذكر مدن من أي مكان في العالم', allCities);
  byLetter('geo-cities', 'geo', 'مدن', allCities, 6);
  byLetter('geo-sa-cities', 'geo', 'مدن سعودية', CITIES.sa!.items, 3);
  add('geo-us-states', 'geo', 'اذكر ولايات أمريكية', US_STATES);
  add('geo-sa-regions', 'geo', 'اذكر مناطق السعودية الإدارية', SA_REGIONS);
  add('geo-rivers', 'geo', 'اذكر أنهار', RIVERS);
  add('geo-mountains', 'geo', 'اذكر جبال أو سلاسل جبلية', MOUNTAINS);
  add('geo-seas', 'geo', 'اذكر بحار ومحيطات وخلجان', SEAS);
  add('geo-landmarks', 'geo', 'اذكر معالم سياحية مشهورة', LANDMARKS);
  add('geo-gcc', 'geo', 'اذكر دول الخليج وعواصمها', ['السعودية', 'الإمارات|الامارات', 'الكويت', 'قطر', 'البحرين', 'عمان', 'الرياض', 'أبوظبي|ابوظبي', 'مدينة الكويت', 'الدوحة', 'المنامة', 'مسقط'], 4);

  // ---------- Football ----------
  // Both player lists, same player merged by name (forms and clubs together); entries without clubs only add nothing.
  const byName = new Map<string, { name: string; nat: string; pos: string; clubs: string[] }>();
  for (const [name, nat, pos, clubs] of [...PLAYERS, ...PLAYERS2.filter((x) => x[3].trim()), ...wdPlayers()]) {
    const head = name.split('|')[0]!.trim();
    const cl = clubs.split(' ').filter((c) => c && CLUBS[c]);
    const had = byName.get(head);
    if (had) {
      had.name = [...new Set([...had.name.split('|'), ...name.split('|')])].join('|');
      had.clubs = [...new Set([...had.clubs, ...cl])];
    } else byName.set(head, { name, nat, pos, clubs: cl });
  }
  // No Iranian players (nothing about Iran in the game).
  const P = [...byName.values()].filter((p) => p.nat !== 'ir');
  const clubName = (id: string) => CLUBS[id]![0].split('|')[0]!;
  const leagueOf = (id: string) => CLUBS[id]?.[1];
  const POS: Record<string, string> = { G: 'حراس مرمى', D: 'مدافعين', M: 'لاعبي وسط', F: 'مهاجمين وأجنحة' };
  add('fb-all', 'football', 'اذكر لاعبين كرة قدم مشهورين', P.map((p) => p.name));
  for (const [k, n] of Object.entries(POS)) add(`fb-pos-${k}`, 'football', `اذكر ${n} مشهورين`, P.filter((p) => p.pos === k).map((p) => p.name));
  // Each club's players, found once (the pairs below intersect these instead of scanning every player).
  const byClub = new Map<string, typeof P>();
  for (const p of P) for (const c of new Set(p.clubs)) (byClub.get(c) ?? byClub.set(c, []).get(c)!).push(p);
  for (const id of Object.keys(CLUBS)) {
    const inClub = byClub.get(id) ?? [];
    add(`fb-club-${id}`, 'football', `اذكر لاعبين لعبوا في ${clubName(id)}`, inClub.map((p) => p.name), 5);
    for (const [k, n] of Object.entries(POS)) add(`fb-club-${id}-${k}`, 'football', `اذكر ${n} لعبوا في ${clubName(id)}`, inClub.filter((p) => p.pos === k).map((p) => p.name), 6);
    for (const [nat, label] of Object.entries(NATIONS)) add(`fb-club-${id}-${nat}`, 'football', `اذكر لاعبين ${label} لعبوا في ${clubName(id)}`, inClub.filter((p) => p.nat === nat).map((p) => p.name), 6);
  }
  for (const [lg, ln] of Object.entries(LEAGUES)) {
    const inLeague = P.filter((p) => p.clubs.some((c) => leagueOf(c) === lg));
    add(`fb-league-${lg}`, 'football', `اذكر لاعبين لعبوا في ${ln}`, inLeague.map((p) => p.name));
    add(`fb-league-clubs-${lg}`, 'football', `اذكر أندية لعبت في ${ln}`, Object.values(CLUBS).filter((c) => c[1] === lg).map((c) => c[0]), 6);
    for (const [k, n] of Object.entries(POS)) add(`fb-league-${lg}-${k}`, 'football', `اذكر ${n} لعبوا في ${ln}`, inLeague.filter((p) => p.pos === k).map((p) => p.name), 5);
    for (const [nat, label] of Object.entries(NATIONS)) add(`fb-league-${lg}-${nat}`, 'football', `اذكر لاعبين ${label} لعبوا في ${ln}`, inLeague.filter((p) => p.nat === nat).map((p) => p.name), 6);
  }
  for (const [nat, label] of Object.entries(NATIONS)) {
    add(`fb-nat-${nat}`, 'football', `اذكر لاعبين ${label}`, P.filter((p) => p.nat === nat).map((p) => p.name));
    for (const [k, n] of Object.entries(POS)) add(`fb-nat-${nat}-${k}`, 'football', `اذكر ${n} ${label}`, P.filter((p) => p.nat === nat && p.pos === k).map((p) => p.name), 5);
  }
  const ids = Object.keys(CLUBS);
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const [a, b] = [byClub.get(ids[i]!) ?? [], byClub.get(ids[j]!) ?? []];
      const both = (a.length <= b.length ? a : b).filter((p) => p.clubs.includes(ids[a.length <= b.length ? j : i]!));
      add(`fb-pair-${ids[i]}-${ids[j]}`, 'football', `اذكر لاعبين لعبوا في ${clubName(ids[i]!)} و${clubName(ids[j]!)}`, both.map((p) => p.name), 5);
    }
  const lgs = Object.keys(LEAGUES);
  for (let i = 0; i < lgs.length; i++)
    for (let j = i + 1; j < lgs.length; j++) {
      const both = P.filter((p) => p.clubs.some((c) => leagueOf(c) === lgs[i]) && p.clubs.some((c) => leagueOf(c) === lgs[j]));
      add(`fb-lpair-${lgs[i]}-${lgs[j]}`, 'football', `اذكر لاعبين لعبوا في ${LEAGUES[lgs[i]!]} و${LEAGUES[lgs[j]!]}`, both.map((p) => p.name), 6);
    }
  const REGION: Record<string, [string, string[]]> = {
    arab: ['عرب', ['sa', 'eg', 'ma', 'dz', 'tn']],
    africa: ['أفارقة', ['eg', 'ma', 'dz', 'tn', 'sn', 'ci', 'ng', 'cm', 'gh', 'ga', 'gn', 'ml', 'lr']],
    samerica: ['من أمريكا الجنوبية', ['ar', 'br', 'uy', 'co', 'cl']],
    asia: ['آسيويين', ['sa', 'jp', 'kr', 'ir', 'au']],
    europe: ['أوروبيين', ['pt', 'es', 'fr', 'en', 'de', 'it', 'nl', 'be', 'hr', 'se', 'no', 'pl', 'dk', 'si', 'rs', 'ge', 'tr', 'ua', 'cz', 'ro', 'bg', 'ch', 'at', 'ie', 'sc', 'wa', 'nie']],
  };
  for (const [rk, [rl, nats]] of Object.entries(REGION))
    for (const [lg, ln] of Object.entries(LEAGUES))
      add(`fb-region-${rk}-${lg}`, 'football', `اذكر لاعبين ${rl} لعبوا في ${ln}`, P.filter((p) => nats.includes(p.nat) && p.clubs.some((c) => leagueOf(c) === lg)).map((p) => p.name), 6);
  const arabNat = new Set(['sa', 'eg', 'ma', 'dz', 'tn', 'iq', 'qa', 'ae', 'kw', 'jo', 'sy', 'lb', 'om', 'bh', 'ly', 'sd', 'ps', 'ye']);
  add('fb-arab', 'football', 'اذكر لاعبين عرب', P.filter((p) => arabNat.has(p.nat)).map((p) => p.name));
  add('fb-african', 'football', 'اذكر لاعبين أفارقة', P.filter((p) => ['eg', 'ma', 'dz', 'tn', 'sn', 'ci', 'ng', 'cm', 'gh', 'ga', 'gn', 'ml', 'lr'].includes(p.nat)).map((p) => p.name));
  add('fb-asian', 'football', 'اذكر لاعبين آسيويين', P.filter((p) => ['sa', 'qa', 'ae', 'kw', 'bh', 'om', 'iq', 'jo', 'sy', 'jp', 'kr', 'au'].includes(p.nat)).map((p) => p.name), 5);
  add('fb-arab-europe', 'football', 'اذكر لاعبين عرب لعبوا في أوروبا', P.filter((p) => arabNat.has(p.nat) && p.clubs.some((c) => ['es', 'en', 'it', 'de', 'fr', 'pt', 'nl', 'tr'].includes(leagueOf(c) ?? ''))).map((p) => p.name));
  add('fb-clubs-arab', 'football', 'اذكر أندية عربية', Object.values(CLUBS).filter((c) => ['sa', 'eg', 'qa', 'ae', 'ma', 'tn'].includes(c[1])).map((c) => c[0]));
  add('fb-clubs-europe', 'football', 'اذكر أندية أوروبية', Object.values(CLUBS).filter((c) => ['es', 'en', 'it', 'de', 'fr', 'pt', 'nl', 'tr', 'sc', 'gr'].includes(c[1])).map((c) => c[0]));
  add('fb-wc-winners', 'football', 'اذكر منتخبات فازت بكأس العالم', ['البرازيل|Brazil', 'ألمانيا|المانيا|Germany', 'إيطاليا|ايطاليا|Italy', 'الأرجنتين|الارجنتين|Argentina', 'فرنسا|France', 'الأوروغواي|اوروجواي|Uruguay', 'إنجلترا|انجلترا|England', 'إسبانيا|اسبانيا|Spain'], 4);
  add('fb-ballon', 'football', 'اذكر لاعبين فازوا بالكرة الذهبية', ['ميسي|ليونيل ميسي', 'كريستيانو رونالدو|رونالدو', 'مودريتش', 'بنزيما', 'رودري', 'كاكا', 'رونالدينيو', 'رونالدو نازاريو|الظاهرة', 'زيدان', 'فيغو', 'ريفالدو', 'شيفتشينكو', 'نيدفيد', 'كانافارو', 'أوين|اوين', 'ماتيوس', 'فان باستن', 'بلاتيني', 'كرويف', 'بيكنباور', 'جورج وياه|وياه', 'ستويتشكوف', 'باجيو', 'غيرد مولر', 'دي ستيفانو', 'أوزيبيو|اوزيبيو', 'بابان', 'خوليت', 'ديمبيلي'], 6);
  add('fb-coaches', 'football', 'اذكر مدربين كرة قدم مشهورين', ['بيب غوارديولا|غوارديولا|Guardiola', 'يورغن كلوب|كلوب|Klopp', 'جوزيه مورينيو|مورينيو|Mourinho', 'كارلو أنشيلوتي|انشيلوتي|Ancelotti', 'أليكس فيرغسون|فيرغسون|Ferguson', 'أرسين فينغر|فينغر|Wenger', 'زين الدين زيدان|زيدان', 'دييغو سيميوني|سيميوني', 'تشابي ألونسو|ألونسو', 'ميكيل أرتيتا|ارتيتا|Arteta', 'لويس إنريكي|انريكي|Luis Enrique', 'هانز فليك|فليك|Flick', 'توماس توخيل|توخيل|Tuchel', 'أنطونيو كونتي|كونتي|Conte', 'ماوريسيو بوتشيتينو|بوتشيتينو|Pochettino', 'إريك تين هاغ|تين هاغ', 'أوناي إيمري|ايمري|Emery', 'ماسيميليانو أليغري|اليغري|Allegri', 'جورجي جيسوس|جيسوس', 'هيرفي رينارد|رينارد|Renard', 'روبرتو مانشيني|مانشيني|Mancini', 'لويس فان خال|فان خال', 'فابيو كابيلو|كابيلو', 'ماركو فان باستن', 'روبيرتو دي زيربي|دي زيربي', 'آنجي بوستيكوجلو|بوستيكوجلو', 'ستيفانو بيولي|بيولي', 'رافائيل بينيتيز|بينيتيز', 'لويس فيليبي سكولاري|سكولاري', 'ديدييه ديشامب|ديشامب', 'يواكيم لوف|لوف', 'فيسنتي ديل بوسكي|ديل بوسكي', 'ليونيل سكالوني|سكالوني', 'ماوريسيو ساري|ساري', 'سيموني إنزاغي|انزاغي', 'خوليان ناغلسمان|ناغلسمان', 'رالف رانغنيك|رانغنيك', 'جوزيه بيسيرو', 'ماتياس يايسله|يايسله', 'ستيفانو بيولي'], 8);

  // ---------- Video games ----------
  const G = GAMES.map(([name, tags]) => ({ name, tags: tags.split(' ').filter(Boolean) }));
  const CO: Record<string, string> = { nintendo: 'نينتندو', sony: 'سوني (بلايستيشن)', ms: 'مايكروسوفت (إكس بوكس)', ea: 'EA', ubisoft: 'يوبيسوفت', activision: 'أكتيفيجن', rockstar: 'روكستار', capcom: 'كابكوم', square: 'سكوير إنكس', sega: 'سيغا', bandai: 'باندي نامكو', konami: 'كونامي', blizzard: 'بليزارد', bethesda: 'بيثيسدا', valve: 'فالف', '2k': '2K', wb: 'وارنر براذرز', fromsoft: 'فروم سوفتوير', epic: 'إيبك غيمز', riot: 'رايوت' };
  for (const [k, n] of Object.entries(CO)) add(`gm-co-${k}`, 'games', `اذكر ألعاب من شركة ${n}`, G.filter((g) => g.tags.includes(k)).map((g) => g.name), 4);
  const GEN: Record<string, string> = { fps: 'تصويب منظور شخص أول (FPS)', shooter: 'تصويب', rpg: 'تقمص أدوار (RPG)', race: 'سباق', sport: 'رياضة', football: 'كورة', fight: 'قتال', horror: 'رعب', br: 'باتل رويال', open: 'عالم مفتوح', adventure: 'مغامرات', platform: 'منصات', puzzle: 'ألغاز', strategy: 'استراتيجية', moba: 'موبا', survival: 'بقاء', sandbox: 'ساندبوكس/بناء' };
  for (const [k, n] of Object.entries(GEN)) add(`gm-genre-${k}`, 'games', `اذكر ألعاب ${n}`, G.filter((g) => g.tags.includes(k) || (k === 'shooter' && g.tags.includes('fps'))).map((g) => g.name), 4);
  for (const [ck, cn] of Object.entries(CO))
    for (const [gk, gn] of Object.entries(GEN))
      add(`gm-co-${ck}-${gk}`, 'games', `اذكر ألعاب ${gn} من شركة ${cn}`, G.filter((g) => g.tags.includes(ck) && g.tags.includes(gk)).map((g) => g.name), 4);
  add('gm-all', 'games', 'اذكر ألعاب فيديو', G.map((g) => g.name));
  add('gm-ps', 'games', 'اذكر ألعاب حصرية على بلايستيشن', G.filter((g) => g.tags.includes('ps')).map((g) => g.name));
  add('gm-xbox', 'games', 'اذكر ألعاب حصرية على إكس بوكس', G.filter((g) => g.tags.includes('xbox')).map((g) => g.name), 4);
  add('gm-mobile', 'games', 'اذكر ألعاب جوال مشهورة', ['ببجي|PUBG', 'فري فاير|Free Fire', 'كلاش أوف كلانس|Clash of Clans', 'كلاش رويال|Clash Royale', 'براول ستارز|Brawl Stars', 'صب واي سيرفرز|Subway Surfers', 'كاندي كراش|Candy Crush', 'أنغري بيردز|Angry Birds', 'بوكيمون غو|Pokemon Go', 'كول أوف ديوتي موبايل|COD Mobile', 'روبلوكس|Roblox', 'ماينكرافت|Minecraft', 'أمونغ أس|Among Us', 'ستومبل غايز|Stumble Guys', 'موبايل ليجندز|Mobile Legends', 'جينشين إمباكت|Genshin Impact', 'فورتنايت|Fortnite', 'إي فوتبول|eFootball|بيس', 'إي إيه إف سي موبايل|FC Mobile', 'تيمبل رن|Temple Run', 'فروت نينجا|Fruit Ninja', 'كاتشب', 'هاي داي|Hay Day', 'بوم بيتش|Boom Beach', 'لودو ستار|لودو|Ludo', 'كيرم|Carrom', 'جواكر|Jawaker', 'بلوت|Baloot', 'تريكس', 'أسفلت|Asphalt', 'هيل كلايمب|Hill Climb Racing', 'جيومتري داش|Geometry Dash', 'فلابي بيرد|Flappy Bird', 'شطرنج|Chess', 'ببجي نيو ستيت', 'وايلد ريفت|Wild Rift', 'هونكاي|Honkai', 'آرينا أوف فالور|Arena of Valor'].filter((x) => x.includes('|')), 6);
  const SERIES: Record<string, string> = { mario: 'ماريو', zelda: 'زيلدا', cod: 'كول أوف ديوتي', gta: 'جي تي إي', ac: 'أساسنز كريد', re: 'ريزدنت إيفل', ff: 'فاينل فانتسي', gow: 'غود أوف وار', forza: 'فورزا', halo: 'هيلو' };
  for (const [k, n] of Object.entries(SERIES)) add(`gm-series-${k}`, 'games', `اذكر ألعاب من سلسلة ${n}`, G.filter((g) => g.tags.includes(k)).map((g) => g.name), 3);
  delete GAME_CHARACTERS.pokemon; // no Pokémon
  for (const [k, v] of Object.entries(GAME_CHARACTERS)) add(`gm-chars-${k}`, 'games', `اذكر شخصيات من ${v.label}`, v.items);
  byLetter('gm-all', 'games', 'ألعاب فيديو', G.map((g) => g.name), 5);

  // ---------- General ----------
  const A = ANIMALS.map(([name, tags]) => ({ name, tags: tags.split(' ') }));
  const AT: Record<string, string> = { m: 'حيوانات ثديية', b: 'طيور', s: 'حيوانات بحرية', r: 'زواحف وبرمائيات', i: 'حشرات وحشرات زاحفة', w: 'حيوانات برية (متوحشة)', p: 'حيوانات أليفة أو حيوانات مزرعة', af: 'حيوانات تعيش في أفريقيا', pr: 'حيوانات مفترسة' };
  add('gn-animals', 'general', 'اذكر حيوانات', A.map((a) => a.name));
  for (const [k, n] of Object.entries(AT)) add(`gn-animals-${k}`, 'general', `اذكر ${n}`, A.filter((a) => a.tags.includes(k)).map((a) => a.name));
  byLetter('gn-animals', 'general', 'حيوانات', A.map((a) => a.name), 4);
  for (const [k, v] of Object.entries(LISTS)) {
    if (k === 'anime') continue; // no anime questions
    const cat = v.cat as ListCategory;
    add(`gn-${k}`, cat, v.text, v.items);
    // Every list also by first letter («اذكر رياضات تبدأ بحرف …»), where there are enough answers.
    byLetter(`gn-${k}`, cat, v.text.replace(/^اذكر /, ''), v.items, ['boys', 'girls', 'surahs'].includes(k) ? 3 : 5);
  }
  add('gn-fruitveg', 'general', 'اذكر فواكه أو خضروات', [...LISTS.fruits!.items, ...LISTS.vegetables!.items]);
  byLetter('gn-fruitveg', 'general', 'فواكه أو خضروات', [...LISTS.fruits!.items, ...LISTS.vegetables!.items], 4);
  add('gn-cars-all', 'general', 'اذكر أسماء سيارات (ماركات أو موديلات)', ['toyota', 'hyundai', 'nissan', 'kia', 'benz', 'ford', 'chevy', 'carBrands'].flatMap((k) => LISTS[k]!.items));
  for (const [k, v] of Object.entries(EXTRA)) {
    add(`ex-${k}`, v.cat, v.text, v.items);
    byLetter(`ex-${k}`, v.cat, v.text.replace(/^اذكر /, ''), v.items, 5);
  }
  for (const [k, v] of Object.entries(CITIES)) byLetter(`geo-cities-${k}`, 'geo', `مدن في ${v.label}`, v.items, 4);
  byLetter('geo-landmarks', 'geo', 'معالم سياحية', LANDMARKS, 4);
  byLetter('geo-us-states', 'geo', 'ولايات أمريكية', US_STATES, 3);
  for (const [k, v] of Object.entries(GAME_CHARACTERS)) byLetter(`gm-chars-${k}`, 'games', `شخصيات من ${v.label}`, v.items, 4);
  byLetter('gm-chars', 'games', 'شخصيات ألعاب فيديو', Object.values(GAME_CHARACTERS).flatMap((v) => v.items), 8);

  // ---------- إسلاميات ----------
  for (const [k, v] of Object.entries(ISLAMIC)) {
    add(`is-${k}`, 'islamic', v.text, v.items, 4);
    byLetter(`is-${k}`, 'islamic', v.text.replace(/^اذكر /, '').replace(/^من /, ''), v.items, 4);
  }
  add('is-quran-misc', 'islamic', 'اذكر سور قصيرة من جزء عمّ', LISTS.surahs!.items.slice(77), 6);
  byLetter('is-all', 'islamic', 'أي شيء إسلامي (سورة، نبي، صحابي، غزوة، اسم من أسماء الله…)', [...Object.values(ISLAMIC).flatMap((v) => v.items), ...LISTS.surahs!.items, ...LISTS.prophets!.items], 8);

  // ---------- أمثال ----------
  const PV = PROVERBS.map(([p, tags]) => ({ p, tags: tags.split(' ').filter(Boolean) }));
  const PT: Record<string, string> = { animal: 'فيها حيوان أو طير', food: 'فيها أكل أو شرب', body: 'فيها عضو من الجسم (عين، يد، راس…)', patience: 'عن الصبر', friend: 'عن الصديق والرفقة', money: 'عن الفلوس', talk: 'عن الكلام والسكوت', work: 'عن العمل والاجتهاد', time: 'عن الوقت والأيام', family: 'عن الأهل والقرابة', gulf: 'خليجية شعبية', knowledge: 'عن العلم والعقل والحكمة', egypt: 'مصرية شعبية' };
  add('pv-all', 'proverbs', 'اذكر أمثال عربية أو شعبية', PV.map((x) => x.p));
  for (const [k, n] of Object.entries(PT)) add(`pv-${k}`, 'proverbs', `اذكر أمثال ${n}`, PV.filter((x) => x.tags.includes(k)).map((x) => x.p), 4);
  byLetter('pv-all', 'proverbs', 'أمثال', PV.map((x) => x.p), 4);
  add('pv-short', 'proverbs', 'اذكر أمثال قصيرة (ثلاث كلمات أو أقل)', PV.filter((x) => x.p.split('|')[0]!.trim().split(/\s+/).length <= 3).map((x) => x.p));
  add('pv-long', 'proverbs', 'اذكر أمثال طويلة (خمس كلمات أو أكثر)', PV.filter((x) => x.p.split('|')[0]!.trim().split(/\s+/).length >= 5).map((x) => x.p));
  byLetter('fb-letter', 'football', 'لاعبين كورة', P.map((p) => p.name), 6);
  // «Anyone famous / any place / any film» by letter: several Wikidata lists together.
  const many = (keys: string[]) => keys.flatMap((k) => EXTRA[k]?.items ?? []);
  const people = many(['painters', 'wactors', 'wsingers', 'writers', 'scientists', 'uspres', 'singers', 'actors', 'famousArabs']);
  add('gn-people', 'general', 'اذكر أشخاصًا مشهورين (فنانين، علماء، كتّاب، رؤساء…)', people);
  byLetter('gn-people', 'general', 'أشخاصًا مشهورين (أي مجال)', people, 8);
  const screen = many(['films', 'egfilms', 'wseries', 'arseries', ...Object.keys(EXTRA).filter((k) => /^p(films|series)-/.test(k))]);
  add('gn-screen', 'general', 'اذكر أفلامًا أو مسلسلات', screen);
  byLetter('gn-screen', 'general', 'أفلامًا أو مسلسلات', screen, 6);
  const sights = many(['skyscrapers', 'waterfalls']).concat(LANDMARKS);
  byLetter('geo-sights', 'geo', 'معالم وأماكن (قلاع، متاحف، أبراج، شلالات، جزر…)', sights, 8);
    const history = many(['wars', 'battles']);
  byLetter('gn-history', 'general', 'شيئًا من التاريخ (حرب، معركة، إمبراطورية، دولة قديمة)', history, 6);
  byLetter('gn-names', 'general', 'أسماء (ولد أو بنت)', [...LISTS.boys!.items, ...LISTS.girls!.items], 8);
  byLetter('gn-food', 'general', 'أكلات أو حلويات أو مشروبات', [...LISTS.foods!.items, ...LISTS.desserts!.items, ...LISTS.drinks!.items], 6);
  byLetter('gn-things', 'general', 'أشياء جامدة (في البيت أو المطبخ أو ملابس)', [...LISTS.home!.items, ...LISTS.kitchen!.items, ...LISTS.clothes!.items, ...EXTRA.school!.items], 6);
  byLetter('geo-places', 'geo', 'أماكن (دول أو مدن أو عواصم)', [...COUNTRIES.map((c) => c[0]), ...allCities], 10);
  byLetter('gn-brands', 'general', 'ماركات (سيارات أو ملابس أو تقنية أو مطاعم)', [...LISTS.carBrands!.items, ...EXTRA.brands!.items, ...LISTS.techBrands!.items, ...LISTS.fastfood!.items, ...EXTRA.watches!.items], 5);
  // «Anything that starts with…»: every general list together.
  const everything = [...A.map((a) => a.name), ...COUNTRIES.map((c) => c[0]), ...COUNTRIES.map((c) => c[1]), ...Object.values(LISTS).filter((l) => l.cat === 'general').flatMap((l) => l.items)];
  byLetter('gn-any', 'general', 'أي شيء (حيوان، أكل، دولة، اسم، مهنة…)', everything, 10);

  // Very hard ones out: a specialist list with few answers, or a letter with almost nothing to name.
  // Only questions most players in the region can answer: easy and medium, no specialist lists, nothing about Iran.
  return qs.map((q) => ({ ...q, level: levelOf(q) })).filter((q) => q.level !== 'hard' && !OFF_AUDIENCE.test(q.id) && !IRAN.test(q.id + q.text));
}

let cached: ListQuestion[] | null = null;
export const listBank = () => (cached ??= buildBank());
