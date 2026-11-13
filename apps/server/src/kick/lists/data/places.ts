// Cities and other places, grouped for «اذكر مدن في …» questions.
export const CITIES: Record<string, { label: string; items: string[] }> = {
  sa: { label: 'السعودية', items: [
    'الرياض|Riyadh', 'جدة|جده|Jeddah', 'مكة|مكة المكرمة|مكه|Makkah|Mecca', 'المدينة المنورة|المدينه|Madinah|Medina', 'الدمام|Dammam', 'الخبر|Khobar',
    'الظهران|Dhahran', 'الطائف|Taif', 'تبوك|Tabuk', 'أبها|ابها|Abha', 'خميس مشيط|Khamis Mushait', 'جازان|جيزان|Jazan', 'نجران|Najran', 'حائل|Hail',
    'بريدة|Buraidah', 'عنيزة|Unaizah', 'الرس|Ar Rass', 'الأحساء|الاحساء|الهفوف|Al Ahsa|Hofuf', 'الجبيل|Jubail', 'القطيف|Qatif', 'حفر الباطن|Hafar Al Batin',
    'الخرج|Kharj', 'ينبع|Yanbu', 'الباحة|Baha', 'عرعر|Arar', 'سكاكا|Sakaka', 'القريات|Qurayyat', 'رابغ|Rabigh', 'القنفذة|Qunfudhah', 'بيشة|Bisha',
    'الزلفي|Zulfi', 'المجمعة|Majmaah', 'شقراء|Shaqra', 'الدوادمي|Dawadmi', 'وادي الدواسر|Wadi Al Dawasir', 'العلا|AlUla', 'الوجه|Al Wajh', 'أملج|املج|Umluj',
    'ضباء|Duba', 'تيماء|Tayma', 'دومة الجندل|Dumat Al Jandal', 'طريف|Turaif', 'رفحاء|Rafha', 'الخفجي|Khafji', 'رأس تنورة|راس تنوره|Ras Tanura', 'بقيق|Abqaiq',
    'صبيا|Sabya', 'أبو عريش|ابو عريش|Abu Arish', 'صامطة|Samtah', 'محايل عسير|محايل|Muhayil', 'النماص|Namas', 'بلجرشي|Baljurashi', 'المذنب|Mithnab', 'البكيرية|Bukayriyah',
    'الدرعية|Diriyah', 'نيوم|NEOM', 'شرورة|Sharurah', 'القويعية|Quwayiyah', 'عفيف|Afif', 'الأفلاج|الافلاج|Aflaj', 'حوطة بني تميم|Hotat Bani Tamim', 'تربة|Turabah', 'الليث|Lith',
    'خليص|Khulais', 'بدر|Badr', 'العقيق|Aqiq', 'ثادق|Thadiq', 'رماح|Rumah', 'المزاحمية|Muzahmiyah', 'ضرما|Dhurma', 'حريملاء|Huraymila', 'الغاط|Ghat', 'سدير|Sudair',
  ] },
  eg: { label: 'مصر', items: [
    'القاهرة|Cairo', 'الإسكندرية|الاسكندرية|Alexandria', 'الجيزة|Giza', 'بورسعيد|بور سعيد|Port Said', 'السويس|Suez', 'الإسماعيلية|الاسماعيلية|Ismailia', 'المنصورة|Mansoura',
    'طنطا|Tanta', 'الزقازيق|Zagazig', 'دمياط|Damietta', 'أسيوط|اسيوط|Asyut', 'سوهاج|Sohag', 'المنيا|Minya', 'بني سويف|Beni Suef', 'الفيوم|Faiyum', 'قنا|Qena',
    'الأقصر|الاقصر|Luxor', 'أسوان|اسوان|Aswan', 'الغردقة|Hurghada', 'شرم الشيخ|Sharm El Sheikh', 'دهب|Dahab', 'مرسى مطروح|مطروح|Marsa Matruh', 'العريش|Arish',
    'كفر الشيخ|Kafr El Sheikh', 'شبين الكوم|Shibin El Kom', 'بنها|Banha', 'المحلة الكبرى|المحلة|Mahalla', 'دمنهور|Damanhur', 'العين السخنة|Ain Sokhna', 'العلمين|Alamein',
    'سيوة|Siwa', 'الواحات|Oases', 'رشيد|Rosetta', 'العاصمة الإدارية|New Capital', 'مرسى علم|Marsa Alam', 'سفاجا|Safaga', 'طابا|Taba', 'نويبع|Nuweiba', 'الطور|El Tor',
  ] },
  ae: { label: 'الإمارات', items: [
    'دبي|Dubai', 'أبوظبي|ابوظبي|Abu Dhabi', 'الشارقة|Sharjah', 'عجمان|Ajman', 'رأس الخيمة|راس الخيمه|Ras Al Khaimah', 'الفجيرة|Fujairah', 'أم القيوين|ام القيوين|Umm Al Quwain',
    'العين|Al Ain', 'خورفكان|Khor Fakkan', 'كلباء|Kalba', 'دبا|Dibba', 'الذيد|Dhaid', 'مدينة زايد|Zayed City', 'الرويس|Ruwais', 'ليوا|Liwa', 'حتا|Hatta',
  ] },
  us: { label: 'أمريكا', items: [
    'نيويورك|New York', 'لوس أنجلوس|لوس انجلوس|Los Angeles|LA', 'شيكاغو|Chicago', 'هيوستن|Houston', 'فينكس|Phoenix', 'فيلادلفيا|Philadelphia', 'سان أنطونيو|San Antonio',
    'سان دييغو|San Diego', 'دالاس|Dallas', 'سان خوسيه|San Jose', 'أوستن|اوستن|Austin', 'سان فرانسيسكو|San Francisco', 'سياتل|Seattle', 'دنفر|Denver', 'واشنطن|Washington',
    'بوسطن|Boston', 'ديترويت|Detroit', 'ناشفيل|Nashville', 'ممفيس|Memphis', 'بورتلاند|Portland', 'لاس فيغاس|لاس فيجاس|Las Vegas', 'ميامي|Miami', 'أتلانتا|اتلانتا|Atlanta',
    'أورلاندو|اورلاندو|Orlando', 'تامبا|Tampa', 'نيو أورلينز|New Orleans', 'كليفلاند|Cleveland', 'بيتسبرغ|Pittsburgh', 'سينسيناتي|Cincinnati', 'كانساس سيتي|Kansas City',
    'سانت لويس|St Louis', 'مينيابوليس|Minneapolis', 'ميلووكي|Milwaukee', 'إنديانابوليس|انديانابوليس|Indianapolis', 'شارلوت|Charlotte', 'بالتيمور|Baltimore', 'سولت لايك سيتي|Salt Lake City',
    'سكرامنتو|Sacramento', 'هونولولو|Honolulu', 'أنكوريج|Anchorage', 'بوفالو|Buffalo', 'أوكلاهوما سيتي|Oklahoma City', 'ألباكركي|Albuquerque', 'توكسون|Tucson', 'فورت وورث|Fort Worth',
    'جاكسونفيل|Jacksonville', 'كولومبوس|Columbus', 'ريتشموند|Richmond', 'رالي|Raleigh', 'بروكلين|Brooklyn', 'هوليوود|Hollywood',
  ] },
  es: { label: 'إسبانيا', items: [
    'مدريد|Madrid', 'برشلونة|Barcelona', 'فالنسيا|Valencia', 'إشبيلية|اشبيلية|Sevilla|Seville', 'سرقسطة|Zaragoza', 'مالقة|ملقا|Malaga', 'مرسية|Murcia', 'بالما|Palma',
    'بلباو|Bilbao', 'أليكانتي|اليكانتي|Alicante', 'قرطبة|Cordoba', 'بلد الوليد|Valladolid', 'فيغو|Vigo', 'خيخون|Gijon', 'غرناطة|Granada', 'لاكورونيا|La Coruna',
    'فيتوريا|Vitoria', 'إلتشي|Elche', 'سانتاندير|Santander', 'سان سيباستيان|San Sebastian', 'بامبلونا|Pamplona', 'سلامنكا|سالامانكا|Salamanca', 'طليطلة|Toledo', 'قادش|Cadiz',
    'ألميريا|الميريا|Almeria', 'خيتافي|Getafe', 'ليغانيس|Leganes', 'فياريال|Villarreal', 'أوفييدو|Oviedo', 'جيرونا|Girona', 'تاراغونا|Tarragona', 'إيبيزا|Ibiza', 'ماربيا|Marbella',
    'لاس بالماس|Las Palmas', 'تينيريفي|Tenerife', 'هويسكا|Huesca', 'ليون|Leon', 'بورغوس|Burgos', 'سانتياغو دي كومبوستيلا|Santiago de Compostela', 'قرطاجنة|Cartagena',
  ] },
  uk: { label: 'بريطانيا', items: [
    'لندن|London', 'مانشستر|Manchester', 'ليفربول|Liverpool', 'برمنغهام|برمنجهام|Birmingham', 'ليدز|Leeds', 'شيفيلد|Sheffield', 'نيوكاسل|Newcastle', 'بريستول|Bristol',
    'نوتنغهام|Nottingham', 'ليستر|Leicester', 'ساوثهامبتون|Southampton', 'برايتون|Brighton', 'أكسفورد|اكسفورد|Oxford', 'كامبريدج|Cambridge', 'يورك|York', 'باث|Bath',
    'أدنبرة|ادنبره|Edinburgh', 'غلاسكو|جلاسكو|Glasgow', 'أبردين|Aberdeen', 'كارديف|Cardiff', 'سوانزي|Swansea', 'بلفاست|Belfast', 'بورنموث|Bournemouth', 'بورتسموث|Portsmouth',
    'كوفنتري|Coventry', 'ديربي|Derby', 'ستوك|Stoke', 'وولفرهامبتون|Wolverhampton', 'بلاكبيرن|Blackburn', 'بيرنلي|Burnley', 'إيبسويتش|Ipswich', 'نوريتش|Norwich', 'هال|Hull',
    'سندرلاند|Sunderland', 'ميدلزبره|Middlesbrough', 'بلاكبول|Blackpool', 'واتفورد|Watford', 'لوتون|Luton', 'ريدينغ|Reading', 'كانتربري|Canterbury',
  ] },
  it: { label: 'إيطاليا', items: [
    'روما|Rome|Roma', 'ميلان|ميلانو|Milan', 'نابولي|Naples|Napoli', 'تورينو|Turin|Torino', 'باليرمو|Palermo', 'جنوة|Genoa', 'بولونيا|Bologna', 'فلورنسا|Florence|Firenze',
    'البندقية|فينيسيا|Venice|Venezia', 'فيرونا|Verona', 'باري|Bari', 'كاتانيا|Catania', 'بيزا|Pisa', 'بيرغامو|Bergamo', 'بارما|Parma', 'مودينا|Modena', 'كالياري|Cagliari',
    'ليتشي|Lecce', 'أوديني|Udine', 'ساليرنو|Salerno', 'سيينا|Siena', 'كومو|Como', 'بيروجيا|Perugia', 'إمبولي|Empoli', 'ساسولو|Sassuolo', 'تريستي|Trieste', 'بريشيا|Brescia',
    'كريمونا|Cremona', 'فروزينوني|Frosinone', 'ريجيو كالابريا|Reggio Calabria', 'ميسينا|Messina', 'رافينا|Ravenna', 'ريميني|Rimini', 'أمالفي|Amalfi', 'كابري|Capri',
  ] },
  de: { label: 'ألمانيا', items: [
    'برلين|Berlin', 'ميونخ|Munich|Munchen', 'هامبورغ|هامبورج|Hamburg', 'كولونيا|كولن|Cologne|Koln', 'فرانكفورت|Frankfurt', 'شتوتغارت|شتوتجارت|Stuttgart', 'دوسلدورف|Dusseldorf',
    'دورتموند|Dortmund', 'إيسن|Essen', 'لايبزيغ|لايبزيج|Leipzig', 'بريمن|Bremen', 'دريسدن|Dresden', 'هانوفر|Hanover', 'نورنبرغ|Nuremberg', 'دويسبورغ|Duisburg', 'بوخوم|Bochum',
    'فوبرتال|Wuppertal', 'بيليفيلد|Bielefeld', 'بون|Bonn', 'مونستر|Munster', 'غيلسنكيرشن|Gelsenkirchen', 'مونشنغلادباخ|Monchengladbach', 'فولفسبورغ|Wolfsburg', 'ماينز|Mainz',
    'أوغسبورغ|Augsburg', 'فرايبورغ|Freiburg', 'هايدلبرغ|Heidelberg', 'كيل|Kiel', 'روستوك|Rostock', 'ليفركوزن|Leverkusen', 'هوفنهايم|Hoffenheim', 'كايزرسلاوترن|Kaiserslautern',
  ] },
  fr: { label: 'فرنسا', items: [
    'باريس|Paris', 'مرسيليا|Marseille', 'ليون|Lyon', 'تولوز|Toulouse', 'نيس|Nice', 'نانت|Nantes', 'ستراسبورغ|Strasbourg', 'مونبلييه|Montpellier', 'بوردو|Bordeaux', 'ليل|Lille',
    'رين|Rennes', 'ريمس|Reims', 'لوهافر|Le Havre', 'سانت إتيان|Saint-Etienne', 'تولون|Toulon', 'غرونوبل|Grenoble', 'ديجون|Dijon', 'أنجيه|Angers', 'نيم|Nimes', 'لانس|Lens',
    'بريست|Brest', 'لوريان|Lorient', 'ميتز|Metz', 'نانسي|Nancy', 'كان|Cannes', 'كاين|Caen', 'أوكسير|Auxerre', 'آميان|Amiens', 'تور|Tours', 'أورليان|Orleans', 'أفينيون|Avignon',
    'كاليه|Calais', 'بياريتز|Biarritz', 'أجاكسيو|Ajaccio', 'شامبيري|Chambery',
  ] },
  tr: { label: 'تركيا', items: [
    'إسطنبول|اسطنبول|Istanbul', 'أنقرة|انقره|Ankara', 'إزمير|ازمير|Izmir', 'بورصة|Bursa', 'أنطاليا|انطاليا|Antalya', 'أضنة|اضنه|Adana', 'قونيا|Konya', 'غازي عنتاب|Gaziantep',
    'طرابزون|Trabzon', 'سامسون|Samsun', 'قيصري|Kayseri', 'مرسين|Mersin', 'ديار بكر|Diyarbakir', 'أرضروم|Erzurum', 'إسكي شهير|Eskisehir', 'ملاطية|Malatya', 'شانلي أورفا|اورفا|Sanliurfa',
    'بودروم|Bodrum', 'ألانيا|الانيا|Alanya', 'فتحية|Fethiye', 'مرمريس|Marmaris', 'سابانجا|Sapanca', 'يالوفا|Yalova', 'كابادوكيا|Cappadocia', 'أوزنجول|Uzungol', 'ريزا|Rize',
    'سيواس|Sivas', 'هاتاي|انطاكيا|Hatay', 'كوجالي|ازميت|Kocaeli', 'دنيزلي|Denizli', 'مانيسا|Manisa', 'بولو|Bolu',
  ] },
  ma: { label: 'المغرب', items: [
    'الرباط|Rabat', 'الدار البيضاء|كازابلانكا|Casablanca', 'مراكش|Marrakech', 'فاس|Fes', 'طنجة|Tangier', 'أكادير|اكادير|Agadir', 'مكناس|Meknes', 'وجدة|Oujda', 'القنيطرة|Kenitra',
    'تطوان|Tetouan', 'سلا|Sale', 'العيون|Laayoune', 'الجديدة|El Jadida', 'آسفي|اسفي|Safi', 'بني ملال|Beni Mellal', 'الناظور|Nador', 'الصويرة|Essaouira', 'شفشاون|Chefchaouen',
    'ورزازات|Ouarzazate', 'إفران|افران|Ifrane', 'المحمدية|Mohammedia', 'خريبكة|Khouribga', 'تازة|Taza', 'الحسيمة|Al Hoceima', 'الداخلة|Dakhla', 'العرائش|Larache',
  ] },
  jp: { label: 'اليابان', items: [
    'طوكيو|Tokyo', 'أوساكا|اوساكا|Osaka', 'كيوتو|Kyoto', 'يوكوهاما|Yokohama', 'ناغويا|ناجويا|Nagoya', 'سابورو|Sapporo', 'كوبي|Kobe', 'فوكوكا|Fukuoka', 'هيروشيما|Hiroshima',
    'ناغازاكي|ناجازاكي|Nagasaki', 'سينداي|Sendai', 'نارا|Nara', 'كاواساكي|Kawasaki', 'أوكيناوا|اوكيناوا|Okinawa', 'ناها|Naha', 'كاغوشيما|Kagoshima', 'نيغاتا|Niigata', 'شيزوكا|Shizuoka',
    'كوماموتو|Kumamoto', 'أوكاياما|Okayama', 'كاناغاوا|Kanagawa', 'سايتاما|Saitama', 'تشيبا|Chiba', 'هاكوداته|Hakodate', 'نيكو|Nikko', 'كاماكورا|Kamakura', 'شيبويا|Shibuya', 'أكيهابارا|Akihabara',
  ] },
};

/** US states (50). */
export const US_STATES = [
  'ألاباما|Alabama', 'ألاسكا|الاسكا|Alaska', 'أريزونا|اريزونا|Arizona', 'أركنساس|اركنساس|Arkansas', 'كاليفورنيا|California', 'كولورادو|Colorado', 'كونيتيكت|Connecticut',
  'ديلاوير|Delaware', 'فلوريدا|Florida', 'جورجيا|Georgia', 'هاواي|Hawaii', 'أيداهو|ايداهو|Idaho', 'إلينوي|الينوي|Illinois', 'إنديانا|انديانا|Indiana', 'آيوا|ايوا|Iowa',
  'كانساس|Kansas', 'كنتاكي|Kentucky', 'لويزيانا|Louisiana', 'مين|Maine', 'ماريلاند|Maryland', 'ماساتشوستس|Massachusetts', 'ميشيغان|ميشيجان|Michigan', 'مينيسوتا|Minnesota',
  'ميسيسيبي|Mississippi', 'ميزوري|Missouri', 'مونتانا|Montana', 'نبراسكا|Nebraska', 'نيفادا|Nevada', 'نيوهامبشير|New Hampshire', 'نيوجيرسي|New Jersey', 'نيومكسيكو|New Mexico',
  'نيويورك|New York', 'كارولاينا الشمالية|نورث كارولاينا|North Carolina', 'داكوتا الشمالية|North Dakota', 'أوهايو|اوهايو|Ohio', 'أوكلاهوما|اوكلاهوما|Oklahoma', 'أوريغون|اوريجون|Oregon',
  'بنسلفانيا|Pennsylvania', 'رود آيلاند|Rhode Island', 'كارولاينا الجنوبية|ساوث كارولاينا|South Carolina', 'داكوتا الجنوبية|South Dakota', 'تينيسي|Tennessee', 'تكساس|Texas',
  'يوتا|Utah', 'فيرمونت|Vermont', 'فرجينيا|فيرجينيا|Virginia', 'واشنطن|Washington', 'فرجينيا الغربية|West Virginia', 'ويسكونسن|Wisconsin', 'وايومنغ|Wyoming',
];

/** Saudi regions (13). */
export const SA_REGIONS = [
  'الرياض|منطقة الرياض', 'مكة المكرمة|منطقة مكة|مكة', 'المدينة المنورة|المدينة', 'القصيم', 'المنطقة الشرقية|الشرقية', 'عسير', 'تبوك', 'حائل', 'الحدود الشمالية',
  'جازان|جيزان', 'نجران', 'الباحة', 'الجوف',
];

export const RIVERS = [
  'النيل|Nile', 'الأمازون|الامازون|Amazon', 'دجلة|Tigris', 'الفرات|Euphrates', 'المسيسيبي|المسيسبي|Mississippi', 'ميزوري|Missouri', 'الدانوب|Danube', 'الراين|Rhine',
  'الفولغا|الفولجا|Volga', 'السين|Seine', 'التايمز|Thames', 'الغانج|الجانج|Ganges', 'السند|Indus', 'اليانغتسي|يانغتسي|Yangtze', 'النهر الأصفر|هوانغ هو|Yellow River',
  'الميكونغ|Mekong', 'الكونغو|Congo', 'النيجر|Niger', 'الزمبيزي|Zambezi', 'الأردن|نهر الأردن|Jordan', 'العاصي|Orontes', 'البو|Po', 'التيبر|Tiber', 'الإلب|Elbe',
  'الأورانج|Orange', 'كولورادو|Colorado', 'ريو غراندي|Rio Grande', 'سانت لورنس|St Lawrence', 'يوكون|Yukon', 'أوب|Ob', 'ينيسي|Yenisei', 'لينا|Lena', 'آمور|Amur',
  'الدنيبر|Dnieper', 'الدون|Don', 'الوادي الكبير|Guadalquivir', 'التاجة|Tagus', 'الإبرو|Ebro', 'بارانا|Parana', 'أورينوكو|Orinoco', 'موراي|Murray', 'سيحون|Syr Darya', 'جيحون|Amu Darya',
  'الرون|Rhone', 'اللوار|Loire', 'البراهمابوترا|Brahmaputra', 'السنغال|Senegal', 'الكارون|Karun',
];

export const MOUNTAINS = [
  'إيفرست|افرست|Everest', 'كي 2|كي تو|K2', 'كليمنجارو|كلمنجارو|Kilimanjaro', 'الألب|الالب|Alps', 'الهيمالايا|Himalaya', 'الأنديز|الانديز|Andes', 'روكي|جبال روكي|Rocky',
  'الأطلس|جبال الاطلس|Atlas', 'القوقاز|Caucasus', 'الأورال|Ural', 'البرانس|Pyrenees', 'الأبلاش|Appalachian', 'مون بلان|Mont Blanc', 'ماترهورن|Matterhorn', 'فوجي|Fuji',
  'إلبروس|Elbrus', 'أكونكاغوا|Aconcagua', 'دينالي|ماكينلي|Denali', 'أرارات|Ararat', 'جبل طويق|طويق', 'جبل السودة|السودة', 'جبل أحد|احد', 'جبل النور|النور', 'جبل عرفات|عرفات',
  'جبل طارق|Gibraltar', 'جبل سيناء|جبل موسى', 'جبل الشيخ|Hermon', 'جبل اللوز|اللوز', 'جبل شمس|Jebel Shams', 'جبل حفيت|Hafeet', 'جبال السروات|السروات', 'جبل أجا|اجا', 'جبل سلمى|سلمى',
  'زاغروس|Zagros', 'هندوكوش|Hindu Kush', 'طوروس|Taurus', 'الكاربات|Carpathians', 'سييرا نيفادا|Sierra Nevada', 'فيزوف|فيزوفيوس|Vesuvius', 'إتنا|Etna',
];

export const SEAS = [
  'البحر الأحمر|الاحمر|Red Sea', 'البحر المتوسط|الأبيض المتوسط|Mediterranean', 'الخليج العربي|Arabian Gulf', 'بحر العرب|Arabian Sea', 'البحر الأسود|الاسود|Black Sea',
  'بحر قزوين|قزوين|Caspian', 'البحر الميت|Dead Sea', 'بحر البلطيق|البلطيق|Baltic', 'بحر الشمال|North Sea', 'البحر الكاريبي|الكاريبي|Caribbean', 'بحر إيجة|ايجة|Aegean',
  'البحر الأدرياتيكي|الادرياتيكي|Adriatic', 'بحر مرمرة|مرمرة|Marmara', 'بحر الصين الجنوبي|South China Sea', 'بحر اليابان|Sea of Japan', 'بحر عمان|خليج عمان',
  'المحيط الهادئ|الهادي|Pacific', 'المحيط الأطلسي|الاطلسي|Atlantic', 'المحيط الهندي|الهندي|Indian Ocean', 'المحيط المتجمد الشمالي|Arctic', 'المحيط المتجمد الجنوبي|Southern Ocean',
  'خليج المكسيك|Gulf of Mexico', 'خليج عدن|Gulf of Aden', 'خليج العقبة|العقبة', 'خليج السويس', 'بحر آزوف|Azov', 'بحر بيرينغ|Bering', 'البحر الأيرلندي|Irish Sea', 'بحر تسمان|Tasman',
];

/** World landmarks. */
export const LANDMARKS = [
  'برج إيفل|ايفل|Eiffel Tower', 'برج خليفة|Burj Khalifa', 'الأهرامات|الاهرامات|Pyramids', 'أبو الهول|ابو الهول|Sphinx', 'سور الصين العظيم|سور الصين|Great Wall',
  'تاج محل|Taj Mahal', 'الكولوسيوم|Colosseum', 'برج بيزا|برج بيزا المائل|Pisa', 'تمثال الحرية|Statue of Liberty', 'بيغ بن|ساعة بيغ بن|Big Ben', 'البتراء|Petra',
  'ماتشو بيتشو|Machu Picchu', 'المسيح الفادي|Christ the Redeemer', 'أوبرا سيدني|اوبرا سيدني|Sydney Opera House', 'الكعبة|الكعبة المشرفة|Kaaba', 'المسجد النبوي', 'المسجد الأقصى|الاقصى|قبة الصخرة',
  'آيا صوفيا|ايا صوفيا|Hagia Sophia', 'برج العرب|Burj Al Arab', 'ساعة مكة|برج الساعة|أبراج البيت', 'برج المملكة|Kingdom Centre', 'برج الفيصلية|الفيصلية', 'العلا|مدائن صالح|الحجر',
  'قصر المصمك|المصمك', 'الدرعية|حي الطريف', 'جسر البوابة الذهبية|Golden Gate', 'تاور بريدج|Tower Bridge', 'قصر باكنغهام|Buckingham Palace', 'اللوفر|متحف اللوفر|Louvre',
  'قوس النصر|Arc de Triomphe', 'ساغرادا فاميليا|Sagrada Familia', 'الحمراء|قصر الحمراء|Alhambra', 'نافورة تريفي|Trevi', 'الفاتيكان|كاتدرائية القديس بطرس', 'الأكروبوليس|Acropolis',
  'ستونهنج|Stonehenge', 'جبل رشمور|Mount Rushmore', 'شلالات نياجرا|نياغرا|Niagara Falls', 'الغراند كانيون|Grand Canyon', 'تايمز سكوير|Times Square', 'إمباير ستيت|Empire State',
  'برج طوكيو|Tokyo Tower', 'برج تورنتو|CN Tower', 'أنغكور وات|Angkor Wat', 'بتروناس|برجا بتروناس|Petronas', 'مارينا باي ساندز|Marina Bay Sands', 'الكرملين|Kremlin', 'الساحة الحمراء|Red Square',
  'نويشفانشتاين|Neuschwanstein', 'بوابة براندنبورغ|Brandenburg Gate', 'برج القاهرة|Cairo Tower', 'معبد الكرنك|الكرنك|Karnak', 'وادي الملوك|Valley of the Kings', 'جامع الشيخ زايد|Sheikh Zayed Mosque',
  'متحف المستقبل|Museum of the Future', 'برج الكويت|أبراج الكويت|Kuwait Towers', 'تشيتشن إيتزا|Chichen Itza', 'جزيرة القيامة|Easter Island', 'بوابة الهند|India Gate',
];
