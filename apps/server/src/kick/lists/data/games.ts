// Video games: [name forms, tags]. Tags: company · genre · series · exclusive platform.
// companies: nintendo sony ms ea ubisoft activision rockstar capcom square sega bandai konami epic valve blizzard bethesda cdpr fromsoft riot mojang 2k wb
// genres: fps shooter rpg race sport football fight horror br (battle royale) open adventure platform puzzle strategy moba mmo sandbox survival stealth music
export type Game = [name: string, tags: string];

export const GAMES: Game[] = [
  // Nintendo
  ['سوبر ماريو بروس|ماريو|Super Mario Bros', 'nintendo platform mario'], ['سوبر ماريو أوديسي|ماريو اوديسي|Super Mario Odyssey', 'nintendo platform mario'],
  ['سوبر ماريو 64|Super Mario 64', 'nintendo platform mario'], ['سوبر ماريو غالاكسي|Super Mario Galaxy', 'nintendo platform mario'],
  ['ماريو كارت|Mario Kart', 'nintendo race mario'], ['ماريو بارتي|Mario Party', 'nintendo mario'], ['سوبر ماريو ووندر|Super Mario Wonder', 'nintendo platform mario'],
  ['زيلدا بريث أوف ذا وايلد|بريث اوف ذا وايلد|Breath of the Wild', 'nintendo adventure open zelda'], ['زيلدا تيرز أوف ذا كينغدم|Tears of the Kingdom', 'nintendo adventure open zelda'],
  ['زيلدا أوكارينا أوف تايم|Ocarina of Time', 'nintendo adventure zelda'], ['سوبر سماش بروس|سماش|Super Smash Bros', 'nintendo fight'],
  ['أنيمال كروسينغ|انيمال كروسنج|Animal Crossing', 'nintendo sandbox'], ['سبلاتون|Splatoon', 'nintendo shooter'], ['ميترويد|Metroid', 'nintendo adventure'],
  ['كيربي|Kirby', 'nintendo platform'], ['دونكي كونغ|Donkey Kong', 'nintendo platform'], ['فاير إمبلم|Fire Emblem', 'nintendo strategy rpg'], ['بيكمين|Pikmin', 'nintendo strategy'],
  ['زينوبليد|Xenoblade', 'nintendo rpg'], ['ويي سبورتس|Wii Sports', 'nintendo sport'], ['لويجي مانشن|Luigi\'s Mansion', 'nintendo adventure mario'],
  // Pokémon games
  ['بوكيمون أحمر وأزرق|بوكيمون ريد|Pokemon Red', 'nintendo rpg pokemon'], ['بوكيمون أصفر|Pokemon Yellow', 'nintendo rpg pokemon'], ['بوكيمون ذهبي وفضي|Pokemon Gold', 'nintendo rpg pokemon'],
  ['بوكيمون سكارليت|Pokemon Scarlet', 'nintendo rpg pokemon'], ['بوكيمون سورد|Pokemon Sword', 'nintendo rpg pokemon'], ['بوكيمون غو|بوكيمون جو|Pokemon Go', 'rpg pokemon'],
  ['بوكيمون أرسيوس|Pokemon Legends Arceus', 'nintendo rpg pokemon'], ['بوكيمون إكس|Pokemon X', 'nintendo rpg pokemon'], ['بوكيمون صن|Pokemon Sun', 'nintendo rpg pokemon'],
  // Sony
  ['غود أوف وار|جود اوف وار|God of War', 'sony adventure gow ps'], ['غود أوف وار راغناروك|God of War Ragnarok', 'sony adventure gow ps'],
  ['ذا لاست أوف أس|لاست اوف اس|The Last of Us', 'sony adventure survival horror ps'], ['أنشارتد|انشارتد|Uncharted', 'sony adventure uncharted ps'],
  ['سبايدر مان|Spider-Man|Marvel\'s Spider-Man', 'sony adventure open ps'], ['هورايزن زيرو داون|هورايزن|Horizon Zero Dawn', 'sony rpg open ps'],
  ['غوست أوف تسوشيما|قوست اوف تسوشيما|Ghost of Tsushima', 'sony adventure open ps'], ['غران توريزمو|جران توريزمو|Gran Turismo', 'sony race ps'],
  ['بلودبورن|Bloodborne', 'sony fromsoft rpg ps'], ['ديز غون|Days Gone', 'sony open survival ps'], ['راتشيت آند كلانك|Ratchet and Clank', 'sony platform ps'],
  ['كراش بانديكوت|كراش|Crash Bandicoot', 'activision platform'], ['سباير|سبايرو|Spyro', 'activision platform'], ['ديث ستراندينغ|Death Stranding', 'sony adventure'],
  ['أسترو بوت|استرو بوت|Astro Bot', 'sony platform ps'], ['ريترنال|Returnal', 'sony shooter ps'], ['كيلزون|Killzone', 'sony fps ps'], ['ليتل بيغ بلانيت|LittleBigPlanet', 'sony platform ps'],
  ['ديترويت بيكم هيومن|Detroit Become Human', 'sony adventure ps'], ['هيفي رين|Heavy Rain', 'sony adventure ps'], ['إنفيموس|Infamous', 'sony open ps'],
  // Microsoft / Xbox
  ['هيلو|Halo', 'ms fps halo xbox'], ['غيرز أوف وار|جيرز اوف وار|Gears of War', 'ms shooter xbox'], ['فورزا هورايزن|Forza Horizon', 'ms race forza xbox'],
  ['فورزا موتورسبورت|Forza Motorsport', 'ms race forza xbox'], ['ستارفيلد|Starfield', 'ms bethesda rpg'], ['سي أوف ثيفز|Sea of Thieves', 'ms adventure'],
  ['ماينكرافت|ماين كرافت|Minecraft', 'ms mojang sandbox survival'], ['مايكروسوفت فلايت سيموليتر|فلايت سيموليتر|Flight Simulator', 'ms'], ['إيج أوف إمباير|ايج اوف امباير|Age of Empires', 'ms strategy'],
  // Rockstar / 2K
  ['جي تي إي|جراند ثفت أوتو|قراند|GTA|Grand Theft Auto', 'rockstar open gta'], ['جي تي إي 5|قراند 5|GTA 5|GTA V', 'rockstar open gta'], ['جي تي إي سان أندرياس|سان اندرياس|San Andreas', 'rockstar open gta'],
  ['جي تي إي فايس سيتي|فايس سيتي|Vice City', 'rockstar open gta'], ['جي تي إي 4|GTA 4|GTA IV', 'rockstar open gta'], ['جي تي إي 6|قراند 6|GTA 6|GTA VI', 'rockstar open gta'],
  ['ريد ديد ريدمبشن|ريد ديد|Red Dead Redemption', 'rockstar open adventure'], ['ريد ديد ريدمبشن 2|ريد ديد 2|Red Dead Redemption 2|RDR2', 'rockstar open adventure'],
  ['ماكس باين|Max Payne', 'rockstar shooter'], ['بولي|Bully', 'rockstar open'], ['إل إيه نوار|LA Noire', 'rockstar adventure'],
  ['إن بي إيه 2K|NBA 2K', '2k sport'], ['بايوشوك|BioShock', '2k fps'], ['بوردرلاندز|Borderlands', '2k fps'], ['سيفيلايزيشن|Civilization', '2k strategy'], ['مافيا|Mafia', '2k open'],
  ['دبليو دبليو إي 2K|WWE 2K', '2k fight sport'],
  // EA
  ['فيفا|FIFA', 'ea sport football'], ['إي إيه إف سي|اف سي|EA FC|EA Sports FC', 'ea sport football'], ['نيد فور سبيد|نيد فور|Need for Speed', 'ea race nfs'],
  ['باتلفيلد|Battlefield', 'ea fps'], ['أبكس ليجندز|ابكس|Apex Legends', 'ea fps br'], ['ذا سيمز|السيمز|The Sims', 'ea sandbox'], ['ماس إفكت|Mass Effect', 'ea rpg'],
  ['ديد سبيس|Dead Space', 'ea horror'], ['ستار وورز جيداي|Star Wars Jedi', 'ea adventure'], ['مادن|Madden', 'ea sport'], ['يو إف سي|UFC', 'ea sport fight'],
  ['إن إتش إل|NHL', 'ea sport'], ['دراغون إيج|Dragon Age', 'ea rpg'], ['إت تيكس تو|It Takes Two', 'ea adventure'], ['بلانتس فيرسس زومبيز|نباتات ضد الزومبي|Plants vs Zombies', 'ea strategy'],
  // Ubisoft
  ['أساسنز كريد|اساسنز كريد|Assassin\'s Creed', 'ubisoft adventure open ac stealth'], ['أساسنز كريد 2|Assassin\'s Creed 2', 'ubisoft adventure open ac'],
  ['أساسنز كريد أوديسي|Odyssey', 'ubisoft rpg open ac'], ['أساسنز كريد فالهالا|فالهالا|Valhalla', 'ubisoft rpg open ac'], ['أساسنز كريد أوريجنز|Origins', 'ubisoft rpg open ac'],
  ['أساسنز كريد ميراج|ميراج|Mirage', 'ubisoft adventure ac'], ['أساسنز كريد بلاك فلاغ|بلاك فلاق|Black Flag', 'ubisoft adventure open ac'], ['أساسنز كريد يونيتي|Unity', 'ubisoft adventure ac'],
  ['فار كراي|Far Cry', 'ubisoft fps open'], ['واتش دوغز|Watch Dogs', 'ubisoft open'], ['رينبو سيكس سيج|رينبو سكس|Rainbow Six Siege', 'ubisoft fps'], ['ذا ديفيجن|The Division', 'ubisoft shooter'],
  ['جست دانس|Just Dance', 'ubisoft music'], ['برنس أوف بيرشيا|أمير فارس|Prince of Persia', 'ubisoft platform adventure'], ['ريمان|Rayman', 'ubisoft platform'], ['فور أونر|For Honor', 'ubisoft fight'],
  ['ذا كرو|The Crew', 'ubisoft race'], ['غوست ريكون|Ghost Recon', 'ubisoft shooter'], ['سبلينتر سيل|Splinter Cell', 'ubisoft stealth'],
  // Activision / Blizzard
  ['كول أوف ديوتي|كود|Call of Duty|COD', 'activision fps cod'], ['كول أوف ديوتي وارزون|وارزون|Warzone', 'activision fps br cod'], ['مودرن وارفير|Modern Warfare', 'activision fps cod'],
  ['بلاك أوبس|بلاك اوبس|Black Ops', 'activision fps cod'], ['كول أوف ديوتي موبايل|Call of Duty Mobile', 'activision fps cod'], ['كول أوف ديوتي وورلد أت وور|World at War', 'activision fps cod'],
  ['توني هوك|Tony Hawk', 'activision sport'], ['غيتار هيرو|جيتار هيرو|Guitar Hero', 'activision music'], ['ديستني|Destiny', 'activision fps'],
  ['وورلد أوف ووركرافت|World of Warcraft|WoW', 'blizzard mmo rpg'], ['أوفرواتش|اوفرواتش|Overwatch', 'blizzard fps'], ['ديابلو|Diablo', 'blizzard rpg'], ['ستاركرافت|StarCraft', 'blizzard strategy'],
  ['هيرثستون|Hearthstone', 'blizzard strategy'], ['كاندي كراش|Candy Crush', 'activision puzzle'],
  // Capcom
  ['ريزدنت إيفل|ريزدنت ايفل|Resident Evil', 'capcom horror re'], ['ريزدنت إيفل 4|Resident Evil 4', 'capcom horror re'], ['ريزدنت إيفل فيليج|فيليج|Resident Evil Village', 'capcom horror re'],
  ['ريزدنت إيفل 2|Resident Evil 2', 'capcom horror re'], ['ريزدنت إيفل 7|Resident Evil 7', 'capcom horror re'], ['ستريت فايتر|Street Fighter', 'capcom fight sf'],
  ['مونستر هانتر|Monster Hunter', 'capcom rpg'], ['ديفل ماي كراي|Devil May Cry|DMC', 'capcom adventure'], ['ميغا مان|ميجا مان|Mega Man', 'capcom platform'], ['ديد رايزينغ|Dead Rising', 'capcom horror'],
  ['أيس أتورني|Ace Attorney', 'capcom puzzle'], ['دراغونز دوغما|Dragon\'s Dogma', 'capcom rpg'], ['أونيموشا|Onimusha', 'capcom adventure'],
  // Square Enix, Sega, Bandai, Konami, FromSoftware
  ['فاينل فانتسي|Final Fantasy', 'square rpg ff'], ['فاينل فانتسي 7|Final Fantasy VII', 'square rpg ff'], ['فاينل فانتسي 16|Final Fantasy XVI', 'square rpg ff'],
  ['كينغدم هارتس|Kingdom Hearts', 'square rpg'], ['دراغون كويست|Dragon Quest', 'square rpg'], ['تومب رايدر|Tomb Raider', 'square adventure'], ['نير أوتوماتا|Nier', 'square rpg'],
  ['سونيك|Sonic', 'sega platform'], ['ياكوزا|لايك أ دراغون|Yakuza', 'sega adventure'], ['بيرسونا|Persona', 'sega rpg'], ['توتال وور|Total War', 'sega strategy'], ['فوتبول مانجر|فوتبول مانيجر|Football Manager', 'sega football sport strategy'],
  ['تيكن|Tekken', 'bandai fight'], ['دراغون بول|دراغون بول زينوفيرس|Dragon Ball', 'bandai fight'], ['ناروتو|Naruto Storm', 'bandai fight'], ['باك مان|Pac-Man', 'bandai'], ['سول كاليبر|Soulcalibur', 'bandai fight'],
  ['ميتال غير|ميتل جير|Metal Gear', 'konami stealth'], ['سايلنت هيل|Silent Hill', 'konami horror'], ['بيس|برو إيفولوشن سوكر|PES|eFootball|إي فوتبول', 'konami sport football'], ['كاستلفانيا|Castlevania', 'konami platform'],
  ['يو غي أوه|Yu-Gi-Oh', 'konami strategy'], ['إلدن رينغ|الدن رينغ|Elden Ring', 'fromsoft bandai rpg open'], ['دارك سولز|Dark Souls', 'fromsoft bandai rpg'], ['سيكيرو|Sekiro', 'fromsoft rpg'], ['آرمورد كور|Armored Core', 'fromsoft shooter'],
  // Others
  ['فورتنايت|Fortnite', 'epic br shooter'], ['ببجي|PUBG', 'br shooter'], ['فري فاير|Free Fire', 'br shooter'], ['ليغ أوف ليجندز|ليق|League of Legends|LoL', 'riot moba'],
  ['فالورانت|Valorant', 'riot fps'], ['دوتا 2|دوتا|Dota 2', 'valve moba'], ['كاونتر سترايك|كاونتر|Counter-Strike|CS', 'valve fps'], ['هاف لايف|Half-Life', 'valve fps'], ['بورتال|Portal', 'valve puzzle'],
  ['ليفت 4 ديد|Left 4 Dead', 'valve fps horror'], ['تيم فورترس|Team Fortress', 'valve fps'], ['روكت ليغ|روكيت ليق|Rocket League', 'epic sport race football'],
  ['ذا ويتشر|ويتشر|The Witcher', 'cdpr rpg open'], ['سايبربانك 2077|سايبربانك|Cyberpunk 2077', 'cdpr rpg open'], ['سكايرم|Skyrim|Elder Scrolls', 'bethesda rpg open'],
  ['فول أوت|فولاوت|Fallout', 'bethesda rpg open'], ['دوم|Doom', 'bethesda fps'], ['وولفنشتاين|Wolfenstein', 'bethesda fps'],
  ['أمونغ أس|امونج اس|Among Us', 'puzzle'], ['روبلوكس|Roblox', 'sandbox'], ['فول غايز|Fall Guys', 'epic br platform'], ['كلاش أوف كلانس|كلاش اوف كلانس|Clash of Clans', 'strategy'],
  ['كلاش رويال|Clash Royale', 'strategy'], ['صب واي سيرفرز|Subway Surfers', 'platform'], ['تيتريس|Tetris', 'puzzle'], ['أنغري بيردز|Angry Birds', 'puzzle'], ['جينشين إمباكت|Genshin Impact', 'rpg open'],
  ['هوغورتس ليغاسي|Hogwarts Legacy', 'wb rpg open'], ['مورتال كومبات|Mortal Kombat', 'wb fight'], ['باتمان أركام|Batman Arkham', 'wb adventure'], ['ميدل إيرث شادو أوف موردور|Shadow of Mordor', 'wb adventure open'],
  ['ليغو|LEGO', 'wb'], ['ستاردو فالي|ستاردو|Stardew Valley', 'sandbox'], ['تيراريا|Terraria', 'sandbox'], ['هولو نايت|Hollow Knight', 'platform'], ['كاب هيد|كابهيد|Cuphead', 'platform'],
  ['آوت لاست|اوت لاست|Outlast', 'horror'], ['فايف نايتس آت فريدي|فناف|Five Nights at Freddy\'s|FNAF', 'horror'], ['ديد باي دايلايت|Dead by Daylight', 'horror'],
  ['فازموفوبيا|Phasmophobia', 'horror'], ['بالدرز غيت 3|بالدرز جيت|Baldur\'s Gate 3', 'rpg'], ['هيدز|Hades', 'rpg'], ['ذا فورست|The Forest', 'survival horror'],
  ['راست|Rust', 'survival'], ['آرك|ARK', 'survival'], ['دي زد|DayZ', 'survival'], ['سابنوتيكا|Subnautica', 'survival'], ['فالهايم|Valheim', 'survival'],
  ['بيت سيبر|Beat Saber', 'music'], ['أوسو|Osu', 'music'], ['ستومبل غايز|ستمبل قايز|Stumble Guys', 'br platform'], ['براول ستارز|Brawl Stars', 'moba'], ['موبايل ليجندز|Mobile Legends', 'moba'], ['فيفا ستريت|FIFA Street', 'ea sport football'], ['ألان ويك|Alan Wake', 'horror'],
];

/** Characters by series, for «اذكر شخصيات من …». */
export const GAME_CHARACTERS: Record<string, { label: string; items: string[] }> = {
  mario: { label: 'ماريو', items: ['ماريو|Mario', 'لويجي|Luigi', 'بيتش|الأميرة بيتش|Peach', 'باوزر|Bowser', 'يوشي|Yoshi', 'تود|Toad', 'واريو|Wario', 'والويجي|Waluigi', 'دايزي|Daisy', 'روزالينا|Rosalina',
    'دونكي كونغ|Donkey Kong', 'بوو|Boo', 'كوبا|Koopa', 'شاي غاي|Shy Guy', 'باوزر جونيور|Bowser Jr', 'غومبا|Goomba', 'لاكيتو|Lakitu', 'دراي بونز|Dry Bones', 'بيردو|Birdo', 'كاموك|Kamek', 'تودت|Toadette', 'ديدي كونغ|Diddy Kong'] },
  pokemon: { label: 'بوكيمون', items: ['بيكاتشو|Pikachu', 'تشارمندر|Charmander', 'تشارميليون|Charmeleon', 'تشاريزارد|Charizard', 'بولباسور|Bulbasaur', 'ايفيسور|Ivysaur', 'فينوسور|Venusaur', 'سكويرتل|Squirtle',
    'وارتورتل|Wartortle', 'بلاستويز|Blastoise', 'جيغلي باف|Jigglypuff', 'ميوتو|Mewtwo', 'ميو|Mew', 'سنورلاكس|Snorlax', 'جينغار|Gengar', 'إيفي|Eevee', 'لوكاريو|Lucario', 'غرينينجا|Greninja', 'ريتشو|Raichu',
    'سايداك|Psyduck', 'ميوث|Meowth', 'أونكس|Onix', 'ماجيكارب|Magikarp', 'غياردوس|Gyarados', 'دراغونايت|Dragonite', 'لابراس|Lapras', 'بيدجي|Pidgey', 'راتاتا|Rattata', 'كاتربي|Caterpie', 'باترفري|Butterfree',
    'ماتشوب|Machop', 'ماتشامب|Machamp', 'جيودود|Geodude', 'فولبيكس|Vulpix', 'نينتيلز|Ninetales', 'أركانين|Arcanine', 'غروليث|Growlithe', 'كوبون|Cubone', 'توجيبي|Togepi', 'مارل|Marill', 'تشيكوريتا|Chikorita',
    'سينداكويل|Cyndaquil', 'توتوديل|Totodile', 'لوجيا|Lugia', 'هو أوه|Ho-Oh', 'تايرانيتار|Tyranitar', 'تريكو|Treecko', 'تورشيك|Torchic', 'مادكيب|Mudkip', 'رايكوازا|Rayquaza', 'غروودون|Groudon',
    'كايوغر|Kyogre', 'غارديفوار|Gardevoir', 'بلازيكن|Blaziken', 'أركيوس|Arceus', 'زيكروم|Zekrom', 'ريشيرام|Reshiram', 'سيلفيون|Sylveon', 'أمبريون|Umbreon', 'إسبيون|Espeon',
    'فابوريون|Vaporeon', 'جولتيون|Jolteon', 'فلاريون|Flareon', 'ميميكيو|Mimikyu', 'روليت|Rowlet', 'ليتن|Litten', 'بوبليو|Popplio', 'زابدوس|Zapdos', 'مولتريس|Moltres', 'أرتيكونو|Articuno',
    'هيتمونلي|Hitmonlee', 'هيتمونتشان|Hitmonchan', 'سكايثر|Scyther', 'كانغاسخان|Kangaskhan', 'دودريو|Dodrio', 'تشانسي|Chansey', 'دتو|ديتو|Ditto', 'بورغون|Porygon', 'أبرا|Abra', 'كادابرا|Kadabra', 'ألاكازام|Alakazam'] },
  sf: { label: 'ستريت فايتر', items: ['ريو|Ryu', 'كين|Ken', 'تشون لي|Chun-Li', 'غايل|Guile', 'زانغيف|Zangief', 'بلانكا|Blanka', 'دالسيم|Dhalsim', 'إي هوندا|E. Honda', 'إم بايسون|بايسون|M. Bison', 'فيغا|Vega',
    'ساغات|Sagat', 'بالروغ|Balrog', 'كامي|Cammy', 'أكوما|Akuma', 'جوري|Juri', 'لوك|Luke', 'جيمي|Jamie', 'كيمبرلي|Kimberly', 'مانون|Manon', 'ماريسا|Marisa', 'ليلي|Lily', 'جي بي|JP', 'دي جي|Dee Jay', 'رشيد|Rashid', 'إيد|Ed', 'دان|Dan', 'ساكورا|Sakura', 'غوكين|Gouken'] },
  tekken: { label: 'تيكن', items: ['جين كازاما|جين|Jin', 'كازويا ميشيما|كازويا|Kazuya', 'هيهاتشي ميشيما|هيهاتشي|Heihachi', 'بول فينيكس|بول|Paul', 'لو|مارشال لو|Law', 'كينغ|King', 'يوشيميتسو|Yoshimitsu',
    'نينا ويليامز|نينا|Nina', 'آنا ويليامز|انا|Anna', 'هوارانغ|Hwoarang', 'شياويو|Xiaoyu', 'إيدي غوردو|ايدي|Eddy', 'برايان فيوري|برايان|Bryan', 'لي تشاولان|لي|Lee', 'ليلي|Lili', 'أسوكا كازاما|اسوكا|Asuka',
    'ستيف فوكس|ستيف|Steve', 'دراغونوف|Dragunov', 'لارس|Lars', 'جاك|Jack', 'كوما|Kuma', 'باندا|Panda', 'ريينا|Reina', 'فيكتور|Victor', 'كلاوديو|Claudio', 'شاهين|Shaheen', 'ليو|Leo', 'فنغ|Feng', 'ليروي|Leroy', 'زافينا|Zafina', 'أليسا|Alisa', 'جون|Jun', 'أزوسينا|Azucena', 'ليدية|Lidia'] },
  mk: { label: 'مورتال كومبات', items: ['سكوربيون|Scorpion', 'ساب زيرو|Sub-Zero', 'ليو كانغ|Liu Kang', 'رايدن|Raiden', 'سونيا بليد|سونيا|Sonya', 'جاكس|Jax', 'جوني كيج|Johnny Cage', 'كانو|Kano', 'كيتانا|Kitana',
    'ميلينا|Mileena', 'شاو كان|Shao Kahn', 'شانغ تسونغ|Shang Tsung', 'كونغ لاو|Kung Lao', 'نوب سايبوت|Noob Saibot', 'رين|Rain', 'سميك|Smoke', 'ريبتايل|Reptile', 'باراكا|Baraka', 'كابال|Kabal', 'غورو|Goro',
    'جايد|Jade', 'سيندل|Sindel', 'كوتال كان|Kotal Kahn', 'دي فورا|D\'Vorah', 'كاسي كيج|Cassie Cage', 'إرماك|Ermac', 'سيراكس|Cyrax', 'سيكتور|Sektor', 'نايت وولف|Nightwolf', 'كوان تشي|Quan Chi', 'شيفا|Sheeva', 'فروست|Frost'] },
  gta: { label: 'جي تي إي', items: ['مايكل|Michael', 'فرانكلين|Franklin', 'تريفور|Trevor', 'سي جي|CJ|كارل جونسون', 'نيكو بيليك|نيكو|Niko', 'تومي فيرسيتي|تومي|Tommy Vercetti', 'لامار|Lamar', 'بيغ سموك|Big Smoke',
    'رايدر|Ryder', 'سويت|Sweet', 'تنبيني|Tenpenny', 'لوسيا|Lucia', 'جيسون|Jason', 'كلود|Claude', 'لانس فانس|Lance Vance', 'رومان|Roman', 'ليستر|Lester', 'كاتالينا|Catalina', 'تشوب|Chop', 'لويس|Luis', 'جوني كلبيتز|Johnny', 'جيمي|Jimmy', 'أماندا|Amanda', 'ترايسي|Tracey'] },
  fortnite: { label: 'فورتنايت', items: ['جونزي|Jonesy', 'بيلي|Peely', 'ميداس|Midas', 'دريفت|Drift', 'رينيغيد ريدر|Renegade Raider', 'سكول تروبر|Skull Trooper', 'رافين|Raven', 'كالامتي|Calamity', 'ميوسكلز|Meowscles',
    'فيشستيك|Fishstick', 'برايت بومبر|Brite Bomber', 'بلاك نايت|Black Knight', 'كادل تيم ليدر|Cuddle Team Leader', 'لينكس|Lynx', 'ذا فوندايشن|Foundation', 'أورا|Aura', 'كريستال|Crystal'] },
};
