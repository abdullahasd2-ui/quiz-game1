// Football clubs: id → [name forms, league]. Leagues: es en it de fr sa pt nl tr eg qa ae us ma tn gr sc br ar
export const CLUBS: Record<string, [string, string]> = {
  // La Liga
  rma: ['ريال مدريد|الريال|Real Madrid', 'es'], bar: ['برشلونة|البارسا|Barcelona|Barca', 'es'], atm: ['أتلتيكو مدريد|اتلتيكو|Atletico Madrid', 'es'],
  sev: ['إشبيلية|اشبيلية|Sevilla', 'es'], val: ['فالنسيا|Valencia', 'es'], vil: ['فياريال|Villarreal', 'es'], bet: ['ريال بيتيس|بيتيس|Real Betis|Betis', 'es'],
  rso: ['ريال سوسيداد|سوسيداد|Real Sociedad', 'es'], ath: ['أتلتيك بلباو|بلباو|Athletic Bilbao', 'es'], cel: ['سيلتا فيغو|سيلتا|Celta Vigo', 'es'],
  get: ['خيتافي|Getafe', 'es'], osa: ['أوساسونا|اوساسونا|Osasuna', 'es'], esp: ['إسبانيول|اسبانيول|Espanyol', 'es'], gir: ['جيرونا|Girona', 'es'],
  mal: ['مايوركا|Mallorca', 'es'], ala: ['ديبورتيفو ألافيس|الافيس|Alaves', 'es'], ray: ['رايو فاييكانو|رايو|Rayo Vallecano', 'es'], lpa: ['لاس بالماس|Las Palmas', 'es'],
  dep: ['ديبورتيفو لاكورونيا|ديبورتيفو|Deportivo', 'es'], mlg: ['ملقا|مالاغا|Malaga', 'es'], lvt: ['ليفانتي|Levante', 'es'], lgn: ['ليغانيس|Leganes', 'es'], gra: ['غرناطة|Granada', 'es'], zar: ['ريال سرقسطة|سرقسطة|Zaragoza', 'es'],
  // Premier League
  mun: ['مانشستر يونايتد|اليونايتد|Manchester United|Man United', 'en'], mci: ['مانشستر سيتي|السيتي|Manchester City|Man City', 'en'], liv: ['ليفربول|Liverpool', 'en'],
  che: ['تشيلسي|Chelsea', 'en'], ars: ['آرسنال|ارسنال|Arsenal', 'en'], tot: ['توتنهام|Tottenham|Spurs', 'en'], new: ['نيوكاسل|Newcastle', 'en'],
  avl: ['أستون فيلا|استون فيلا|Aston Villa', 'en'], whu: ['وست هام|West Ham', 'en'], eve: ['إيفرتون|ايفرتون|Everton', 'en'], lei: ['ليستر سيتي|ليستر|Leicester', 'en'],
  sou: ['ساوثهامبتون|Southampton', 'en'], cry: ['كريستال بالاس|Crystal Palace', 'en'], wol: ['وولفرهامبتون|وولفز|Wolves', 'en'], bha: ['برايتون|Brighton', 'en'],
  ful: ['فولهام|Fulham', 'en'], bou: ['بورنموث|Bournemouth', 'en'], bre: ['برينتفورد|Brentford', 'en'], nfo: ['نوتنغهام فورست|نوتنغهام|Nottingham Forest', 'en'], lee: ['ليدز يونايتد|ليدز|Leeds', 'en'],
  stk: ['ستوك سيتي|ستوك|Stoke', 'en'], swa: ['سوانزي|Swansea', 'en'], wat: ['واتفورد|Watford', 'en'], sun: ['سندرلاند|Sunderland', 'en'], bur: ['بيرنلي|Burnley', 'en'],
  // Serie A
  juv: ['يوفنتوس|اليوفي|Juventus', 'it'], int: ['إنتر ميلان|انتر|الانتر|Inter', 'it'], acm: ['إيه سي ميلان|ميلان|AC Milan', 'it'], nap: ['نابولي|Napoli', 'it'],
  rom: ['روما|Roma', 'it'], laz: ['لاتسيو|Lazio', 'it'], ata: ['أتالانتا|اتالانتا|Atalanta', 'it'], fio: ['فيورنتينا|Fiorentina', 'it'], tor: ['تورينو|Torino', 'it'],
  bol: ['بولونيا|Bologna', 'it'], udi: ['أودينيزي|اودينيزي|Udinese', 'it'], sam: ['سامبدوريا|Sampdoria', 'it'], gen: ['جنوى|جنوا|Genoa', 'it'], par: ['بارما|Parma', 'it'], sas: ['ساسولو|Sassuolo', 'it'],
  // Bundesliga
  bay: ['بايرن ميونخ|البايرن|Bayern Munich|Bayern', 'de'], bvb: ['بوروسيا دورتموند|دورتموند|Dortmund|BVB', 'de'], lev: ['باير ليفركوزن|ليفركوزن|Leverkusen', 'de'],
  rbl: ['لايبزيغ|لايبزيج|RB Leipzig', 'de'], s04: ['شالكه|Schalke', 'de'], wob: ['فولفسبورغ|Wolfsburg', 'de'], bmg: ['بوروسيا مونشنغلادباخ|غلادباخ|Gladbach', 'de'],
  sge: ['آينتراخت فرانكفورت|فرانكفورت|Frankfurt', 'de'], vfb: ['شتوتغارت|Stuttgart', 'de'], svw: ['فيردر بريمن|بريمن|Werder Bremen', 'de'], hsv: ['هامبورغ|Hamburg', 'de'], hof: ['هوفنهايم|Hoffenheim', 'de'],
  // Ligue 1
  psg: ['باريس سان جيرمان|باريس|PSG|Paris Saint-Germain', 'fr'], om: ['أولمبيك مارسيليا|مارسيليا|Marseille', 'fr'], ol: ['أولمبيك ليون|ليون|Lyon', 'fr'],
  asm: ['موناكو|Monaco', 'fr'], losc: ['ليل|Lille', 'fr'], ogcn: ['نيس|Nice', 'fr'], srfc: ['رين|Rennes', 'fr'], bdx: ['بوردو|Bordeaux', 'fr'], rcl: ['لانس|Lens', 'fr'], asse: ['سانت إتيان|Saint-Etienne', 'fr'],
  // Saudi Pro League
  hil: ['الهلال|Al Hilal', 'sa'], nas: ['النصر|Al Nassr', 'sa'], itt: ['الاتحاد|Al Ittihad', 'sa'], ahl: ['الأهلي|الاهلي السعودي|Al Ahli', 'sa'], sha: ['الشباب|Al Shabab', 'sa'],
  ett: ['الاتفاق|Al Ettifaq', 'sa'], taa: ['التعاون|Al Taawoun', 'sa'], fat: ['الفتح|Al Fateh', 'sa'], fay: ['الفيحاء|Al Fayha', 'sa'], qad: ['القادسية|Al Qadsiah', 'sa'],
  rae: ['الرائد|Al Raed', 'sa'], kha: ['الخليج|Al Khaleej', 'sa'], wah: ['الوحدة|Al Wehda', 'sa'], dam: ['ضمك|Damac', 'sa'], ria: ['الرياض|Al Riyadh', 'sa'], okh: ['الأخدود|الاخدود|Al Okhdood', 'sa'],
kho: ['الخلود|Al Kholood', 'sa'], oro: ['العروبة|Al Orobah', 'sa'], fai: ['الفيصلي|Al Faisaly', 'sa'], haz: ['الحزم|Al Hazem', 'sa'], naj: ['النجمة|Al Najma', 'sa'],
  // Portugal, Netherlands, Turkey
  ben: ['بنفيكا|Benfica', 'pt'], por: ['بورتو|Porto', 'pt'], scp: ['سبورتينغ لشبونة|سبورتنغ|Sporting', 'pt'], bra: ['براغا|Braga', 'pt'],
  aja: ['أياكس|اياكس|Ajax', 'nl'], psv: ['آيندهوفن|PSV', 'nl'], fey: ['فينورد|Feyenoord', 'nl'], az: ['ألكمار|AZ', 'nl'],
  gal: ['غلطة سراي|جلطة سراي|Galatasaray', 'tr'], fen: ['فنربخشة|فنربهتشه|Fenerbahce', 'tr'], bjk: ['بشكتاش|Besiktas', 'tr'], tra: ['طرابزون سبور|Trabzonspor', 'tr'],
  // Arab & other leagues
  ahly: ['الأهلي المصري|الاهلي|Al Ahly', 'eg'], zam: ['الزمالك|Zamalek', 'eg'], pyr: ['بيراميدز|Pyramids', 'eg'], ism: ['الإسماعيلي|الاسماعيلي|Ismaily', 'eg'],
  sadd: ['السد|Al Sadd', 'qa'], duh: ['الدحيل|Al Duhail', 'qa'], ray2: ['الريان|Al Rayyan', 'qa'], gha: ['الغرافة|Al Gharafa', 'qa'], aain: ['العين|Al Ain', 'ae'], shj: ['الشارقة|Sharjah', 'ae'], wahd: ['الوحدة الإماراتي|Al Wahda', 'ae'], jaz: ['الجزيرة|Al Jazira', 'ae'],
  wyd: ['الوداد|Wydad', 'ma'], raja: ['الرجاء|Raja', 'ma'], est: ['الترجي|Esperance', 'tn'], css: ['الصفاقسي|Sfaxien', 'tn'],
  mia: ['إنتر ميامي|انتر ميامي|Inter Miami', 'us'], lag: ['لوس أنجلوس غالاكسي|غالاكسي|LA Galaxy', 'us'], tfc: ['تورونتو|Toronto FC', 'us'],
  cel2: ['سيلتك|Celtic', 'sc'], ran: ['رينجرز|Rangers', 'sc'], oly: ['أولمبياكوس|Olympiacos', 'gr'], pao: ['باناثينايكوس|Panathinaikos', 'gr'],
  fla: ['فلامنغو|فلامينجو|Flamengo', 'br'], san: ['سانتوس|Santos', 'br'], cor: ['كورينثيانز|Corinthians', 'br'], pal: ['بالميراس|Palmeiras', 'br'], spfc: ['ساو باولو|Sao Paulo', 'br'], gre: ['غريميو|Gremio', 'br'], flu: ['فلومينينسي|Fluminense', 'br'],
  boc: ['بوكا جونيورز|بوكا|Boca Juniors', 'ar'], riv: ['ريفر بليت|River Plate', 'ar'], nob: ['نيولز أولد بويز|نيولز|Newells', 'ar'],
  zen: ['زينيت|Zenit', 'ru'], sha2: ['شاختار|Shakhtar', 'ua'], dyn: ['دينامو كييف|Dynamo Kyiv', 'ua'], sal: ['سالزبورغ|Salzburg', 'at'], cbr: ['كلوب بروج|Club Brugge', 'be'], and: ['أندرلخت|Anderlecht', 'be'],
};

export const LEAGUES: Record<string, string> = {
  es: 'الدوري الإسباني', en: 'الدوري الإنجليزي', it: 'الدوري الإيطالي', de: 'الدوري الألماني', fr: 'الدوري الفرنسي', sa: 'الدوري السعودي',
  pt: 'الدوري البرتغالي', nl: 'الدوري الهولندي', tr: 'الدوري التركي', br: 'الدوري البرازيلي', us: 'الدوري الأمريكي',
};
