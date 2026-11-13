// «عدّها» questions, built from the data lists: each question is a prompt plus every accepted answer.
// Built once at startup; the stream page asks for one question at a time (/api/kick/lists/next).
import { COUNTRIES } from './data/countries';
import { CITIES, US_STATES, SA_REGIONS, RIVERS, MOUNTAINS, SEAS, LANDMARKS } from './data/places';
import { CLUBS, LEAGUES } from './data/clubs';
import { PLAYERS, NATIONS } from './data/players';
import { GAMES, GAME_CHARACTERS } from './data/games';
import { ANIMALS, LISTS } from './data/general';
import { EXTRA } from './data/extra';
import { ISLAMIC } from './data/islamic';
import { PROVERBS } from './data/proverbs';

export type ListCategory = 'football' | 'geo' | 'general' | 'games' | 'islamic' | 'proverbs';
export type ListQuestion = { id: string; cat: ListCategory; text: string; answers: string[] };

export const LIST_CATEGORIES: { id: ListCategory; name: string; icon: string }[] = [
  { id: 'football', name: 'كورة', icon: '⚽' },
  { id: 'geo', name: 'جغرافيا', icon: '🌍' },
  { id: 'general', name: 'عامة', icon: '💡' },
  { id: 'games', name: 'ألعاب فيديو', icon: '🎮' },
  { id: 'islamic', name: 'إسلاميات', icon: '🕌' },
  { id: 'proverbs', name: 'أمثال', icon: '📜' },
];

const LETTERS = 'ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي'.split(' ');
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
/** Merge forms of the same answer that came from different lists, keep order, drop exact repeats. */
function uniq(items: string[]): string[] {
  const seen = new Map<string, number>();
  const out: string[] = [];
  for (const it of items) {
    const head = it.split('|')[0]!.trim();
    if (seen.has(head)) {
      const i = seen.get(head)!;
      const forms = new Set([...out[i]!.split('|'), ...it.split('|')]);
      out[i] = [...forms].join('|');
    } else {
      seen.set(head, out.length);
      out.push(it);
    }
  }
  return out;
}

export function buildBank(): ListQuestion[] {
  const qs: ListQuestion[] = [];
  const add = (id: string, cat: ListCategory, text: string, answers: string[], min = 5) => {
    const a = uniq(answers.filter(Boolean));
    if (a.length >= min) qs.push({ id, cat, text, answers: a });
  };
  const byLetter = (id: string, cat: ListCategory, what: string, items: string[], min = 6) => {
    for (const l of LETTERS) add(`${id}-${l}`, cat, `اذكر ${what} تبدأ بحرف «${l}»`, items.filter((a) => letters(a).has(l)), min);
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
  const P = PLAYERS.map(([name, nat, pos, clubs]) => ({ name, nat, pos, clubs: clubs.split(' ').filter(Boolean) }));
  const clubName = (id: string) => CLUBS[id]![0].split('|')[0]!;
  const leagueOf = (id: string) => CLUBS[id]?.[1];
  const POS: Record<string, string> = { G: 'حراس مرمى', D: 'مدافعين', M: 'لاعبي وسط', F: 'مهاجمين وأجنحة' };
  add('fb-all', 'football', 'اذكر لاعبين كرة قدم مشهورين', P.map((p) => p.name));
  for (const [k, n] of Object.entries(POS)) add(`fb-pos-${k}`, 'football', `اذكر ${n} مشهورين`, P.filter((p) => p.pos === k).map((p) => p.name));
  for (const id of Object.keys(CLUBS)) {
    const inClub = P.filter((p) => p.clubs.includes(id));
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
      const both = P.filter((p) => p.clubs.includes(ids[i]!) && p.clubs.includes(ids[j]!));
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
  const arabNat = new Set(['sa', 'eg', 'ma', 'dz', 'tn']);
  add('fb-arab', 'football', 'اذكر لاعبين عرب', P.filter((p) => arabNat.has(p.nat)).map((p) => p.name));
  add('fb-african', 'football', 'اذكر لاعبين أفارقة', P.filter((p) => ['eg', 'ma', 'dz', 'tn', 'sn', 'ci', 'ng', 'cm', 'gh', 'ga', 'gn', 'ml', 'lr'].includes(p.nat)).map((p) => p.name));
  add('fb-asian', 'football', 'اذكر لاعبين آسيويين', P.filter((p) => ['sa', 'jp', 'kr', 'ir', 'au'].includes(p.nat)).map((p) => p.name), 5);
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
  const SERIES: Record<string, string> = { mario: 'ماريو', zelda: 'زيلدا', pokemon: 'بوكيمون', cod: 'كول أوف ديوتي', gta: 'جي تي إي', ac: 'أساسنز كريد', re: 'ريزدنت إيفل', ff: 'فاينل فانتسي', gow: 'غود أوف وار', forza: 'فورزا', halo: 'هيلو' };
  for (const [k, n] of Object.entries(SERIES)) add(`gm-series-${k}`, 'games', `اذكر ألعاب من سلسلة ${n}`, G.filter((g) => g.tags.includes(k)).map((g) => g.name), 3);
  for (const [k, v] of Object.entries(GAME_CHARACTERS)) add(`gm-chars-${k}`, 'games', `اذكر شخصيات من ${v.label}`, v.items);
  byLetter('gm-all', 'games', 'ألعاب فيديو', G.map((g) => g.name), 5);

  // ---------- General ----------
  const A = ANIMALS.map(([name, tags]) => ({ name, tags: tags.split(' ') }));
  const AT: Record<string, string> = { m: 'حيوانات ثديية', b: 'طيور', s: 'حيوانات بحرية', r: 'زواحف وبرمائيات', i: 'حشرات وحشرات زاحفة', w: 'حيوانات برية (متوحشة)', p: 'حيوانات أليفة أو حيوانات مزرعة', af: 'حيوانات تعيش في أفريقيا', pr: 'حيوانات مفترسة' };
  add('gn-animals', 'general', 'اذكر حيوانات', A.map((a) => a.name));
  for (const [k, n] of Object.entries(AT)) add(`gn-animals-${k}`, 'general', `اذكر ${n}`, A.filter((a) => a.tags.includes(k)).map((a) => a.name));
  byLetter('gn-animals', 'general', 'حيوانات', A.map((a) => a.name), 4);
  for (const [k, v] of Object.entries(LISTS)) {
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
  const PT: Record<string, string> = { animal: 'فيها حيوان أو طير', food: 'فيها أكل أو شرب', body: 'فيها عضو من الجسم (عين، يد، راس…)', patience: 'عن الصبر', friend: 'عن الصديق والرفقة', money: 'عن الفلوس', talk: 'عن الكلام والسكوت', work: 'عن العمل والاجتهاد', time: 'عن الوقت والأيام', family: 'عن الأهل والقرابة', gulf: 'خليجية شعبية' };
  add('pv-all', 'proverbs', 'اذكر أمثال عربية أو شعبية', PV.map((x) => x.p));
  for (const [k, n] of Object.entries(PT)) add(`pv-${k}`, 'proverbs', `اذكر أمثال ${n}`, PV.filter((x) => x.tags.includes(k)).map((x) => x.p), 4);
  byLetter('pv-all', 'proverbs', 'أمثال', PV.map((x) => x.p), 4);
  add('pv-short', 'proverbs', 'اذكر أمثال قصيرة (ثلاث كلمات أو أقل)', PV.filter((x) => x.p.split('|')[0]!.trim().split(/\s+/).length <= 3).map((x) => x.p));
  add('pv-long', 'proverbs', 'اذكر أمثال طويلة (خمس كلمات أو أكثر)', PV.filter((x) => x.p.split('|')[0]!.trim().split(/\s+/).length >= 5).map((x) => x.p));
  byLetter('fb-letter', 'football', 'لاعبين كورة', P.map((p) => p.name), 6);
  byLetter('gn-names', 'general', 'أسماء (ولد أو بنت)', [...LISTS.boys!.items, ...LISTS.girls!.items], 8);
  byLetter('gn-food', 'general', 'أكلات أو حلويات أو مشروبات', [...LISTS.foods!.items, ...LISTS.desserts!.items, ...LISTS.drinks!.items], 6);
  byLetter('gn-things', 'general', 'أشياء جامدة (في البيت أو المطبخ أو ملابس)', [...LISTS.home!.items, ...LISTS.kitchen!.items, ...LISTS.clothes!.items, ...EXTRA.school!.items], 6);
  byLetter('geo-places', 'geo', 'أماكن (دول أو مدن أو عواصم)', [...COUNTRIES.map((c) => c[0]), ...allCities], 10);
  byLetter('gn-brands', 'general', 'ماركات (سيارات أو ملابس أو تقنية أو مطاعم)', [...LISTS.carBrands!.items, ...EXTRA.brands!.items, ...LISTS.techBrands!.items, ...LISTS.fastfood!.items, ...EXTRA.watches!.items], 5);
  // «Anything that starts with…»: every general list together.
  const everything = [...A.map((a) => a.name), ...COUNTRIES.map((c) => c[0]), ...COUNTRIES.map((c) => c[1]), ...Object.values(LISTS).filter((l) => l.cat === 'general').flatMap((l) => l.items)];
  byLetter('gn-any', 'general', 'أي شيء (حيوان، أكل، دولة، اسم، مهنة…)', everything, 10);

  return qs;
}

let cached: ListQuestion[] | null = null;
export const listBank = () => (cached ??= buildBank());
