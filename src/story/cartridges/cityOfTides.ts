import type { Locale, StoryCartridge, StoryDangerDirector, StoryImageDirector } from '../types'

const coverImage = new URL('../img/worlds/city-of-tides.webp', import.meta.url).href
const entryImage = new URL('../img/worlds/city-of-tides-entry.webp', import.meta.url).href
const audioThemeUrl = new URL('../audio/assets/theme.mp3', import.meta.url).href
const audioAmbienceUrl = new URL('../audio/assets/ambience.mp3', import.meta.url).href
const audioFeatureUrl = new URL('../audio/assets/feature.mp3', import.meta.url).href

function build(locale: Locale): StoryCartridge {
  const zh = locale === 'zh'
  const s = (cn: string, en: string) => zh ? cn : en
  return {
    schemaVersion: 1,
    id: 'city-of-tides',
    locale,
    coverImage,
    entryImage,
    transitionAnchor: s('逆潮罗盘与随身潮汐航图', 'the Countertide Compass and your portable tide chart'),
    copy: {
      title: s('潮痕之城', 'CITY OF TIDES'),
      subtitle: s('有些归途，要等海水退去才会出现', 'Some roads home appear only when the sea withdraws'),
      promise: s('自由探索一座每天改变道路的海港，在第七次大潮前找到从明天呼唤你的姐姐。', 'Explore a harbor that changes roads every day, and find the sister calling you from tomorrow before the seventh great tide.'),
      enter: s('乘船回到潮痕之城', 'Return to the City of Tides'),
      continue: s('继续寻找米拉', 'Continue searching for Mira'),
      customAction: s('也可以说说你真正想做什么', 'Or say what you truly want to do'),
      itemImagingTitle: s('潮铜图谱正在显影', 'The tide-copper plates are developing'),
      itemImagingBody: s('你把行囊放在干燥的防水布上。盐雾沿铜线退开，每件物品的形状与来历正依次显露；其余图谱会在旅途中静静成形。', 'You lay the pack on dry waterproof cloth. Salt mist withdraws along copper lines as each object and its history emerge; the remaining plates will develop quietly as you travel.'),
    },
    theme: { outer: '#071316', surface: '#102428', paper: '#e8e2d4', ink: '#202c2d', muted: '#6f7875', accent: '#6f9f96', danger: '#b35f53', gold: '#bd8057', material: 'harbor' },
    audioTheme: {
      recorded: { music: { src: audioThemeUrl, gain: .19 }, ambience: { src: audioAmbienceUrl, gain: .31 }, cues: { discovery: { src: audioFeatureUrl, gain: .18, role: 'feature', cooldownMs: 180_000 }, summary: { src: audioFeatureUrl, gain: .18, role: 'feature', cooldownMs: 180_000 } } },
      material: 'harbor', bpm: 64, rootHz: 146.83, scale: [0, 2, 5, 7, 9],
      levels: { music: .15, ambient: .16, sfx: .42, master: .46 },
      tension: [
        { statId: 'vitality', direction: 'low', weight: .45 },
        { statId: 'tide-breath', direction: 'low', weight: .3 },
        { statId: 'city-bond', direction: 'low', weight: .25 },
      ],
    },
    itemImageDirection: 'cinematic coastal fantasy artifact study, oxidized tide-copper, salt glass, dark waterproof cloth and restrained warm lamplight, tactile grounded realism',
    sceneImageDirection: 'cinematic coastal fantasy adventure, monumental half-flooded harbor architecture, deep teal water, oxidized copper, mist-white sky and warm human interiors, clear physical action and intimate emotion, consistent recurring characters',
    sceneImageAvoid: 'the return-ferry hero view, a straight exposed stone road leading toward the whole city, the lighthouse panorama, or a compass held large in the foreground',
    imageDirector: {
      maxQuietTurns: 3, softCooldownTurns: 2,
      guaranteedTriggers: ['new-location', 'party-change', 'chapter-checkpoint'],
      softTriggers: ['relationship-change', 'objective-change', 'skill-outcome', 'rare-item'],
      perspective: { ordinary: 'balanced', importantDialogue: 'first-person', newLocation: 'observer' },
    } satisfies StoryImageDirector,
    director: {
      mode: 'open-world',
      fixedWorldRules: zh ? [
        '这是大众可理解的海港奇幻世界，以渡船、灯塔、车站、市场、钟楼、屋顶、水路和旧街为基础，不堆叠陌生术语。',
        '城市每日两次低潮和两次高潮。低潮开放街道、礁洞、地窖与轨道；高潮开放水路、屋顶码头、漂浮设施和上升气流。长移动、等待与重大行动推进时间和潮相。',
        '强烈言语或行动第一次被海水淹没时，会在潮铜或潮石上留下最多七个潮相的回声。只有零号潮门的相同潮位能让回声错位穿过时间，这不是任意预知未来的能力。',
        '七年前无钟之夜，包括米拉在内的四十七人失踪。米拉主动把玩家送上离城列车后返回零号潮门；官方无人伤亡记录是谎言。不能改写人数、原因或把米拉写成无行动能力的待救者。',
        '玩家离开故乡七年，姓名、性别和外貌来自当前玩家。玩家以为自己抛下米拉，但米拉从未责怪玩家；不要替玩家规定其他性格和道德。',
        '序章后灯塔区、沉水车站、雨棚市场和钟楼档案馆均可自由选择。第七次大潮由主线节点推进，不因探索或回访突然结束。',
        '尼洛是机敏、嘴硬心软的屋顶摆渡人。遇见新人物不能让尼洛或其他已确认同伴消失；离队必须有正文中明确发生的原因。',
        '人物只知道自己亲历、听说或读到的事情。已确认的地点、潮相、关系、伤势、承诺、物品归属和事件后果不能静默改写。',
        '主线是玩家连续的个人冒险。其他玩家痕迹只能是可忽略的警告、物品或临时路线，不能替代主线人物、目标、同伴或结局。',
      ] : [
        'This is accessible coastal fantasy built from ferries, lighthouses, stations, markets, bell towers, rooftops, waterways and old streets. Avoid dense invented terminology.',
        'The city has two low and two high tides each day. Low tide opens streets, caves, cellars and rails; high tide opens waterways, rooftop docks, floating structures and rising air. Long travel, waiting and major action advance time and tide.',
        'A powerful word or deed leaves an echo in tide-copper or tide-stone when first submerged, lasting at most seven tide phases. Only matching tides at Gate Zero displace echoes in time; this is not general future sight.',
        'On the Bell-less Night seven years ago, forty-seven people including Mira vanished. Mira put the player on the departing train and returned to Gate Zero. The official no-casualty record is a lie. Never change the count or cause, or reduce Mira to a helpless captive.',
        'The player left home seven years ago. Their name, gender and appearance come from the current player. They believe they abandoned Mira, but Mira never blamed them. Do not prescribe other personality or morality.',
        'After the prologue, Lighthouse Ward, Drowned Station, Rain Market and Bell Archive are freely selectable. The seventh great tide advances through main-story nodes, never merely because the player explores or revisits.',
        'Nilo is a quick-witted rooftop ferryman with guarded kindness. Meeting a stranger never erases Nilo or another confirmed companion; departure requires a visible reason.',
        'People know only what they witnessed, heard or read. Confirmed places, tides, relationships, injuries, promises, ownership and consequences cannot be silently rewritten.',
        'The main story is the player continuous personal adventure. Other-player traces may only be optional warnings, items or temporary routes; they never replace characters, objectives, companions or endings.',
      ],
      generationRules: zh ? [
        '可生成局部地点、居民委托、天气、潮兽、宝物、传闻和关系事件。序章主要推进返乡、潮相改变、认识尼洛、米拉第一道回声和登高看见四区。',
        '每轮至少改变位置、时间、目标、数值、物品、关系或已知事实之一；移动和等待必须更新时钟，不能连续只写气氛。',
        '玩家可以拒绝建议、检查任何可见物、返回、等待潮相、攀行、乘船、交涉、潜行、利用环境或自由尝试其他合理行动。不要强迫立刻追主线。',
        '障碍优先允许观察、交涉、环境、物品、冒险或正面冲突等多种方法，不把战斗设为唯一答案。',
        '稀有物品必须先在正文说明能力、限制或代价与来源。失败造成受伤、损失、路线变化、不信任或潮相推进，不删档也不永久切断主线。',
        '每次回应停在新的具体抉择，只提供一至五个真正匹配当前局面的按钮，不凑满三个，也不丢弃有效的第四、第五项。禁止用泛化的“继续游戏”替代具体选择。',
        '到达潮钟瞭望台并看见四区是可继续的章节边界，不锁输入；之后可以选任意区域或继续在港区探索。',
      ] : [
        'You may create local places, resident requests, weather, tide beasts, treasures, rumors and relationship events. The prologue mainly advances the return, a tide change, meeting Nilo, Mira first echo and the overlook revealing four districts.',
        'Every turn changes at least one location, time, objective, stat, item, relationship or known fact. Travel and waiting update the clock; never write consecutive atmosphere-only turns.',
        'The player may reject suggestions, inspect visible things, return, wait for a tide, climb, sail, negotiate, sneak, use the environment or attempt another plausible action. Never force immediate pursuit of the main quest.',
        'Obstacles should allow observation, negotiation, environment use, items, risk or confrontation where plausible. Combat is not the only solution.',
        'Before adding rare treasure, explain its ability, limitation or cost and source in visible prose. Failure causes injury, loss, route change, distrust or tide advance, never save deletion or permanent main-story loss.',
        'End each response at a new concrete decision. Offer one to five buttons that match the visible situation; never pad to three or discard a grounded fourth or fifth choice. Never replace them with a generic Continue game.',
        'Reaching Tidewatch Overlook and seeing four districts is a continuable checkpoint, not a locked ending; the player may choose any district or keep exploring the harbor.',
      ],
      choiceIntents: zh ? ['观察、追踪回声或与人交涉', '移动并利用环境或物品', '承担风险、帮助别人或采取自定方法'] : ['observe, trace an echo or talk', 'move and use the environment or items', 'take a risk, help someone or choose another method'],
      maxActiveThreads: 3,
    },
    dangerDirector: {
      minSafeTurns: 3, maxSafeTurns: 5, cooldownTurns: 1,
      escalationStats: ['vitality', 'tide-breath'],
      threatPalette: zh
        ? ['潮兽正从退水后的暗处靠近', '涨水正在封闭当前路线', '浸水旧建筑开始坍塌', '潮钟守卫锁定了这片区域', '错位的时间回声正在误导道路', '一名竞争者正沿玩家留下的痕迹追来']
        : ['a tide beast is approaching from the newly exposed dark', 'rising water is sealing the current route', 'a flooded old structure is beginning to collapse', 'tidewatch guards have locked onto the area', 'a displaced time echo is misleading the route', 'a rival is following the player trace'],
      methods: zh ? ['听潮铜回声判断威胁来向', '借折潮帆撤到更高的屋顶', '点燃密封灯芯照亮当前障碍'] : ['Read the threat direction from the tide-copper echo', 'Use the Foldtide Sail to reach a higher roof', 'Light a Sealed Lamp Cell to reveal the obstacle'],
      legacyMethods: [zh ? ['观察潮相、交涉或准备', '潜行、航行或改变路线', '使用环境、物品或正面应对'] : ['read the tide, negotiate, or prepare', 'sneak, sail, or change route', 'use the environment, an item, or confront it']],
      physicalCombat: 'rare',
      resolution: {
        skill: s('潮城应变', 'Tidecraft'), modifier: 2, dcBySeverity: [9, 11, 13, 15, 17],
        fallbackCosts: [{ statId: 'tide-breath', operation: 'remove', amount: 8 }],
      },
    } satisfies StoryDangerDirector,
    initialFacts: { 'mira-recording-heard': true },
    domainRules: [
      {
        id: 'opening-old-road', when: { factUnset: ['opening-path'] },
        action: { exact: [s('趁旧路显露，跟着罗盘提前下船', 'Follow the compass onto the exposed road')] },
        effects: [
          { type: 'fact', key: 'opening-path', value: 'old-road' }, { type: 'fact', key: 'old-road-entered', value: true },
          { type: 'stat', id: 'tide-breath', delta: -6 }, { type: 'map', location: 'old-tide-road' },
          { type: 'clock', value: s('归潮日 · 05:55 · 最低潮', 'Homecoming · 05:55 · Lowest tide') },
          { type: 'objective', value: s('在回潮前读出旧路潮铜里的回声', 'Read the tide-copper echo before the water returns') },
        ],
        successText: s('你没有等渡船靠岸。折潮帆接住一阵横风，把你送到仍在滴水的旧石路上。逆潮罗盘的细针停住，石缝中的潮铜却开始按米拉录音的节奏震动。身后的船笛提醒你：最低潮只剩很短一段时间。', 'You do not wait for the ferry to dock. The Foldtide Sail catches a crosswind and drops you onto the dripping old road. The compass needle stills, but tide-copper in the joints begins pulsing to Mira’s recorded cadence. A ferry horn behind you warns that lowest tide will not last.'),
        successChoices: [s('贴近潮铜，听清它保存的回声', 'Listen closely to the echo held in the tide-copper'), s('沿旧路赶往废弃海关阶梯', 'Follow the old road toward the abandoned customs stair'), s('回头回应翻船处传来的口哨', 'Answer the whistle from the overturned skiff')],
      },
      {
        id: 'opening-rescue', when: { factUnset: ['opening-path'] },
        action: { exact: [s('先去把翻船的人从回流里拉上来', 'Pull the person clear of the backflow first')] },
        effects: [
          { type: 'fact', key: 'opening-path', value: 'rescue' }, { type: 'fact', key: 'rescued-nilo', value: true },
          { type: 'stat', id: 'city-bond', delta: 8 }, { type: 'character', id: 'nilo' },
          { type: 'clock', value: s('归潮日 · 05:50 · 回流转向', 'Homecoming · 05:50 · Backflow turning') },
          { type: 'objective', value: s('借尼洛的屋顶水路追上正在消失的旧路', 'Use Nilo’s rooftop route to catch the vanishing old road') },
        ],
        successText: s('你先把帆索抛向翻船处。抓住缆绳的人踩着船沿翻上甲板，还顺手解开了缠住你脚踝的绳。他叫尼洛，是屋顶码头的摆渡人；他认出罗盘后没有追问，只指向一条能从高处截住旧路的绳桥。你救下的不是一条支线，而是另一条进城路线。', 'You throw the sail line toward the overturned skiff first. The person on the rope vaults over the gunwale and frees the line around your ankle in the same motion. His name is Nilo, a Rooftop Quay ferryman. He recognizes the compass, asks no questions, and points out a rope bridge that can intercept the old road from above. You did not pause the main trail—you found another way into it.'),
        successChoices: [s('跟尼洛走屋顶水路', 'Take Nilo’s rooftop route'), s('先问他为什么认得逆潮罗盘', 'Ask why he recognizes the Countertide Compass'), s('请他稳住翻船，自己追旧路', 'Have him secure the skiff while you chase the old road')],
      },
      {
        id: 'opening-overview', when: { factUnset: ['opening-path'] },
        action: { exact: [s('登上顶层，看清旧路与整座城市的潮向', 'Climb to the upper deck and read the whole tide')] },
        effects: [
          { type: 'fact', key: 'opening-path', value: 'overview' }, { type: 'fact', key: 'city-tide-pattern-seen', value: true },
          { type: 'stat', id: 'city-bond', delta: 4 },
          { type: 'clock', value: s('归潮日 · 05:48 · 潮线显形', 'Homecoming · 05:48 · Tide lines visible') },
          { type: 'objective', value: s('利用观察到的三条潮线选择进城切口', 'Choose an entry using the three tide lines you identified') },
        ],
        successText: s('你爬上渡船顶层，没有立刻追任何一个目标。高度把混乱整理成了三条清楚的潮线：旧石路通往废弃海关，翻船者身后的绳桥连着屋顶码头，而灯塔最后一束光恰好扫过中央潮门的铜脊。罗盘不是只指一条路；它在回应三处尚未兑现的承诺。', 'You climb to the upper deck instead of chasing the first emergency. Height organizes the harbor into three readable tide lines: the old road reaches the abandoned customs stair, the rope bridge behind the capsized ferryman climbs to Rooftop Quay, and the lighthouse’s last beam catches a copper ridge above the central gate. The compass is not pointing to one road. It is answering three unfinished promises.'),
        successChoices: [s('沿旧石路去废弃海关', 'Take the old road to the abandoned customs stair'), s('借绳桥进入屋顶码头', 'Use the rope bridge into Rooftop Quay'), s('继续观察灯塔与中央潮门的光线', 'Keep watching the line between lighthouse and central gate')],
      },
    ],
    statDefinitions: [
      { id: 'vitality', label: s('体力', 'Vitality'), min: 0, max: 100, initial: 72, inverse: true, display: 'bar', warningAt: 25, dangerAt: 0, maxDelta: 24 },
      { id: 'tide-breath', label: s('潮息', 'Tide Breath'), min: 0, max: 100, initial: 40, inverse: true, display: 'bar', warningAt: 20, dangerAt: 0, maxDelta: 25 },
      { id: 'city-bond', label: s('城市联结', 'City Bond'), min: 0, max: 100, initial: 10, inverse: true, display: 'bar', warningAt: 20, dangerAt: 0, maxDelta: 18 },
    ],
    drawerLabels: { party: s('同行者', 'COMPANIONS'), map: s('城市', 'CITY'), inventory: s('行囊', 'PACK'), log: s('潮记', 'TIDELOG') },
    opening: {
      location: s('返乡渡船 · 外港水道', 'Return Ferry · Outer Harbor'),
      time: s('归潮日 · 05:40 · 低潮将至', 'Homecoming · 05:40 · Low tide approaching'),
      objective: s('在渡船靠岸前弄清逆潮罗盘指向什么', 'Learn what the Countertide Compass points to before the ferry docks'),
      imagePrompt: 'wide cinematic dawn view from a returning ferry toward a monumental layered coastal city as deep teal seawater withdraws to reveal an impossible old stone road, a traveler in a weathered dark raincoat holding a small oxidized copper compass in the foreground, distant lighthouse beam through mist, rooftop docks and warm windows, adventurous scale with intimate emotion, no readable text, no letters, no UI, landscape 16:9',
      blocks: [
        { id: 'ct0', kind: 'narration', text: s('你离开潮痕之城整整七年。返乡渡船穿过晨雾时，城市仍像记忆里那样一层叠着一层：低处是被水浸黑的街道，高处是挂着小船的屋顶，最远的灯塔正把最后一束夜光扫过海面。', 'You have been away from the City of Tides for seven years. As the return ferry crosses the dawn mist, the city stacks itself as memory left it: water-dark streets below, small boats hanging from rooftops above, and the far lighthouse sweeping its last night beam across the sea.') },
        { id: 'ct1', kind: 'event', text: s('昨夜寄到你手里的包裹只有三样东西：米拉失踪那晚带走的逆潮罗盘、一张返乡船票，以及一段标注着明日日期的录音。', 'The parcel delivered last night held only three things: the Countertide Compass Mira carried when she vanished, a ticket home, and a recording dated tomorrow.') },
        { id: 'ct2', kind: 'dialogue', speaker: s('米拉', 'Mira'), tone: s('录音里夹着潮声', 'tide noise under the recording'), text: s('如果你听见这个，说明城里又有人敲响了不存在的第十三声钟。别来找我的遗物——我还在零号潮门后面。第七次大潮之前，替我把门打开。', 'If you hear this, someone has rung the thirteenth bell that does not exist. Do not come looking for my remains—I am still behind Gate Zero. Open it before the seventh great tide.') },
        { id: 'ct3', kind: 'narration', text: s('录音结束时，罗盘猛地转向船舷。海水正从码头间退开，一条地图上没有的旧石路缓缓露出；另一侧，一艘被回流撞翻的窄船旁有人抓住了缆绳。渡船还没有靠岸，但你已经可以行动。', 'When the recording ends, the compass snaps toward the rail. Seawater withdraws between the piers, exposing an old road no map remembers; on the other side, someone clings to a rope beside a skiff overturned by the backflow. The ferry has not docked, but you can already act.') },
      ],
      choices: [
        { id: 'old-road', label: s('趁旧路显露，跟着罗盘提前下船', 'Follow the compass onto the exposed road') },
        { id: 'rescue', label: s('先去把翻船的人从回流里拉上来', 'Pull the person clear of the backflow first') },
        { id: 'overview', label: s('登上顶层，看清旧路与整座城市的潮向', 'Climb to the upper deck and read the whole tide') },
      ],
    },
    characters: [{
      id: 'mira', name: s('米拉', 'Mira'), role: s('失踪七年的姐姐', 'your sister, missing for seven years'), vitality: 68, stress: 54, initialStatus: 'known',
      skills: [{ id: 'tide-engineering', label: s('潮门机械', 'Tide engineering'), value: 4 }, { id: 'resolve', label: s('决断', 'Resolve'), value: 3 }],
      detail: s('录音里的声音清醒而急迫。她失踪前穿着旧潮门工作外套，随身带着现在回到你手里的逆潮罗盘。', 'The voice in the recording is alert and urgent. When she vanished, she wore an old gate-worker coat and carried the compass now in your hand.'),
      lore: s('无钟之夜，她主动返回零号潮门，并与另外四十六人一起从官方记录中消失。她不是等待被动营救的人。', 'On the Bell-less Night, she deliberately returned to Gate Zero and disappeared from official records with forty-six others. She is not a passive prisoner.'),
    }, {
      id: 'nilo', name: s('尼洛', 'Nilo'), role: s('屋顶码头摆渡人', 'Rooftop Quay ferryman'), vitality: 84, stress: 28, hiddenUntilIntroduced: true,
      skills: [{ id: 'roof-route', label: s('屋顶水路', 'Rooftop routes'), value: 4 }, { id: 'ropework', label: s('绳索', 'Ropework'), value: 3 }],
      detail: s('从翻船边的缆绳上翻回甲板，动作熟练，认得逆潮罗盘。', 'He vaults from the capsized skiff’s line with practiced ease and recognizes the Countertide Compass.'),
      lore: s('他替屋顶居民摆渡货物与消息，知道不同时段哪些高处路线仍然连通。', 'He ferries goods and news for rooftop residents and knows which elevated routes remain connected at each tide.'),
    }],
    initialMap: [
      { id: 'return-ferry', label: s('返乡渡船', 'Return Ferry'), current: true, detail: s('驶入外港的旧式双层渡船，甲板、船舷和顶层观察台都可活动。', 'An old two-deck ferry entering the outer harbor, with accessible deck, rail and observation roof.'), lore: s('居民按潮位而非钟点安排渡船；这班清晨船在最低潮前靠岸。', 'Residents schedule ferries by tide rather than clock; this dawn boat docks before the lowest water.'), facts: zh ? ['罗盘指向左舷下方', '渡船尚未靠岸', '无名旧路正在显露'] : ['The compass points below the port rail', 'The ferry has not docked', 'An unmarked road is emerging'] },
      { id: 'old-tide-road', label: s('退潮旧路', 'Exposed Tide Road'), connectedTo: s('返乡渡船', 'Return Ferry'), detail: s('只在异常低潮显露的石路，通往废弃海关阶梯。', 'A stone road visible only at an abnormal low tide, leading beneath the abandoned customs stair.'), lore: s('现行地图没有记录它，石缝潮铜可以保存回声。', 'No current map records it; tide-copper seams can hold echoes.'), facts: zh ? ['路面仍在滴水', '回潮后会消失'] : ['The stones still drip', 'It vanishes on the rising tide'] },
      { id: 'rooftop-quay', label: s('屋顶码头', 'Rooftop Quay'), connectedTo: s('返乡渡船', 'Return Ferry'), detail: s('旧仓库屋顶上的码头，窄船、绳桥和雨棚挤在一起。', 'A harbor built on warehouse roofs, crowded with skiffs, rope bridges and rain awnings.'), lore: s('高低潮都能使用，是摆渡人与市场送货者交换消息的地方。', 'It works at either tide and carries ferrymen, market goods and rumors.'), facts: zh ? ['翻船属于屋顶摆渡人', '可从这里登高'] : ['The overturned skiff belongs to a rooftop ferryman', 'Routes climb from here'] },
      { id: 'tidewatch-overlook', label: s('潮钟瞭望台', 'Tidewatch Overlook'), connectedTo: s('屋顶码头', 'Rooftop Quay'), detail: s('能够看见四个城区和中央旧潮门的高台。', 'A high platform overlooking four districts and the buried central gate.'), lore: s('过去守潮人在一圈铜刻度中记录水位。', 'Tidekeepers once recorded water levels against a ring of copper marks.'), facts: [s('尚未抵达', 'Not yet reached')] },
      { id: 'lighthouse-ward', label: s('灯塔区', 'Lighthouse Ward'), connectedTo: s('潮钟瞭望台', 'Tidewatch Overlook'), detail: s('悬崖、礁洞和断裂灯塔平台组成的西侧城区。', 'Western cliffs, reef caves and broken lighthouse platforms.'), lore: s('光决定夜间哪些水路仍能被看见。', 'Light decides which night waterways remain visible.'), facts: [s('低潮走礁洞，高潮借上升气流', 'Reach it through reef caves at low tide or rising air at high tide')] },
      { id: 'drowned-station', label: s('沉水车站', 'Drowned Station'), connectedTo: s('潮钟瞭望台', 'Tidewatch Overlook'), detail: s('只在最低潮完整显露的旧车站与地下轨道。', 'An old station and underground rails fully exposed only at the lowest tide.'), lore: s('无钟之夜最后一班离城列车从这里发出。', 'The last train out on the Bell-less Night departed here.'), facts: [s('乘客名册可能仍在站内', 'The passenger manifest may remain inside')] },
      { id: 'rain-market', label: s('雨棚市场', 'Rain Market'), connectedTo: s('潮钟瞭望台', 'Tidewatch Overlook'), detail: s('低潮在石板街、高潮升上浮台的居民市场。', 'A residents market on stone streets at low tide and rising pontoons at high tide.'), lore: s('食物、消息和离城船票都能找到，代价不一定是钱。', 'Food, news and departure tickets are sold here, though the price is not always money.'), facts: [s('正在准备下一次涨潮宴', 'A rising-tide feast is being prepared')] },
      { id: 'bell-archive', label: s('钟楼档案馆', 'Bell Archive'), connectedTo: s('潮钟瞭望台', 'Tidewatch Overlook'), detail: s('保存正式历史与潮钟顺序的高塔。', 'A high tower containing official history and bell sequences.'), lore: s('只有被锚定的事实才能跨越潮季不被冲淡。', 'Only anchored facts can cross a tide season without fading.'), facts: [s('公开记录声称无钟之夜无人伤亡', 'Its public account says no one died on the Bell-less Night')] },
    ],
    initialInventory: [
      { id: 'countertide-compass', label: s('逆潮罗盘', 'Countertide Compass'), count: 1, rarity: 'legendary', detail: s('掌心大小的氧化铜罗盘，没有方向刻度，细针会朝尚未兑现的承诺转动。', 'A palm-sized oxidized copper compass with no cardinal marks. Its needle turns toward nearby promises left unfulfilled.'), effect: s('感知潮水回声与潮位变化后的路线；读取强回声消耗潮息，透支会混淆自己与他人的记忆。', 'Senses tide echoes and routes exposed by changing water. Strong echoes cost Tide Breath; overuse confuses your memories with another person’s.'), lore: s('米拉在无钟之夜随身携带，七年后与明日录音一起寄回。', 'Mira carried it on the Bell-less Night. Seven years later it returned with a recording dated tomorrow.'), metrics: [{ label: s('指向', 'Bearing'), value: s('左舷下方', 'Below port rail') }, { label: s('潮息消耗', 'Tide Breath cost'), value: '8–18' }], imagePrompt: 'single palm-sized oxidized copper compass with no cardinal letters, fine needle turned sharply sideways, salt glass face and worn leather cord, object only, no hands, no text, square' },
      { id: 'foldtide-sail', label: s('折潮帆', 'Foldtide Sail'), count: 1, detail: s('可折成背包大小的深色短帆，边缘缝着轻薄铜骨。', 'A dark short sail that folds to backpack size, edged with thin copper ribs.'), effect: s('借稳定海风滑过短距离水面或断口；无风、室内和强逆流中无法使用。', 'Crosses short water gaps or broken spans in steady wind; it cannot work indoors, in still air or against a hard current.'), lore: s('旧式离城工具，帆角留着七年前车站托运印的针孔。', 'Old departing-traveler gear; one corner keeps the needle holes of a seven-year-old station tag.'), metrics: [{ label: s('安全跨度', 'Safe span'), value: s('约 25 米', 'About 25 m') }, { label: s('状态', 'Condition'), value: s('可用', 'Usable') }], imagePrompt: 'single folded dark waterproof travel sail with thin oxidized copper ribs and salt-worn straps, object only, no hands, no text, square' },
      { id: 'sealed-lamp-cell', label: s('密封灯芯', 'Sealed Lamp Cell'), count: 2, detail: s('两枚装在盐玻璃管里的暖色灯芯，浸水后仍能维持微光。', 'Two warm wicks sealed in salt-glass tubes, able to keep a dim light after immersion.'), effect: s('照亮潮铜线路、换取小额物资或在黑暗处维持约四十分钟；点燃后不能复原。', 'Lights tide-copper circuits, trades for modest supplies or lasts about forty minutes in darkness. Once lit it cannot be restored.'), lore: s('随返乡票附送的应急用品，旧厂印已经磨平。', 'Emergency gear bundled with the return ticket; the old maker mark has worn away.'), metrics: [{ label: s('数量', 'Quantity'), value: s('2 枚', '2 cells') }, { label: s('单枚时长', 'Duration'), value: s('约 40 分钟', 'About 40 min') }], imagePrompt: 'two sealed warm lamp wicks inside small salt-glass tubes with oxidized copper caps, dark waterproof cloth beneath, object only, no hands, no text, square' },
    ],
    demoTurns: zh ? demoZh : demoEn,
  }
}

const demoZh = [
  { match: ['旧路', '罗盘', '下船', '石路'], content: `你借折潮帆落上湿石路。罗盘针停住，潮铜石缝却开始震动。
翻船处同时传来一声短促口哨，提醒你回流正在转向。
[skill_check: skill="判断潮向" dc="10" rolls="13" modifier="2" total="15" result="success"]
[clock: value="归潮日 · 05:55 · 最低潮"]
[map_update: new_location="退潮旧路" connected_to="返乡渡船" detail="异常低潮显露的湿石路，潮铜正与罗盘共振" lore="现行地图没有这条路" facts="通往废弃海关阶梯|回潮后会消失"]
[widget: tide-breath, remove: 6]
[choices: "贴近潮铜听回声"|"回应翻船处的口哨"|"抢在回潮前沿旧路向下"]` },
  { match: ['翻船', '救', '回流', '拉上来'], content: `你荡到翻船旁。水里的人踩住船沿翻身跃起，还顺手解开了缠住你脚踝的绳。
[尼洛] [main] [笑着喘气]: "谢了。再晚半口气，我也准备自己上来。"
他叫尼洛，是屋顶摆渡人。刚才是海底旧路顶开水流才让他翻船。
[character_update: character_id="nilo" character="尼洛" role="屋顶摆渡人" detail="穿着挂满绳扣的雨衣，正在扶正窄船" lore="熟悉外港水路、绳索和市场，嘴上先谈船费却不会丢下落水者" vitality="86" stress="22" skills="水路: 4|绳索: 3|交涉: 2"]
[reputation: npc="尼洛" action="helped"]
[widget: city-bond, add: 6]
[choices: "把米拉的录音放给尼洛听"|"请尼洛带你靠近旧路"|"确认他安全后独自登顶层"]` },
  { match: ['顶层', '看清', '观察', '潮向'], content: `你登上顶层。雾被风撕开：灯塔、刚露出拱顶的旧车站、浮岛般升起的雨棚市场和没有晨灯的钟楼同时出现。罗盘只指向旧路尽头的海关阶梯。
[map_update: new_location="返乡渡船 · 顶层" connected_to="返乡渡船" detail="能看见旧路和四个城区的观察台" lore="渡船员从这里判断潮向" facts="钟楼没有亮灯|旧车站正在显露|旧路通向海关阶梯"]
[choices: "下到旧路检查阶梯"|"问船员钟楼为何没亮"|"向翻船的人招手"]` },
  { match: ['录音', '海关', '船员'], content: `尼洛听完录音，盯住罗盘。
[尼洛] [main] [压低声音]: "这座城没有第十三声钟。至少活着的人都这么说。"
他提出送你到海关阶梯，船费以后再谈。
[character_update: character_id="nilo" character="尼洛" role="屋顶摆渡人" detail="正把窄船靠向废弃海关" lore="熟悉外港水路、绳索和市场，嘴上先谈船费却不会丢下落水者" vitality="86" stress="28" skills="水路: 4|绳索: 3|交涉: 2"]
[choices: "邀请尼洛同行"|"只请他靠岸，自己下去"|"先问他是否听说过米拉"]` },
  { match: ['同行', '一起', '邀请'], content: `你把备用绳递给尼洛。他不再提船费。
[尼洛] [main] [若无其事]: "我负责不让你淹死，你负责解释那个追着死人转的罗盘。"
[party_change: character_id="nilo" character="尼洛" change="add" role="屋顶摆渡人" detail="与你抵达废弃海关阶梯，负责水路与绳索" lore="熟悉外港水路、绳索和市场" vitality="86" stress="30" skills="水路: 4|绳索: 3|交涉: 2"]
[map_update: new_location="废弃海关阶梯" connected_to="退潮旧路" detail="旧路尽头的铜栏石阶，水位正逐级回升" lore="海关七年前关闭，此后地图删掉下层入口" facts="铜栏保存强烈回声|屋顶出口仍可达"]
[clock: value="归潮日 · 06:18 · 涨潮"]
[choices: "握住铜栏听米拉的回声"|"与尼洛抢在涨水前登顶"|"点亮灯芯检查阶梯下方"]` },
  { match: ['米拉', '回声', '铜栏', '潮铜'], content: `海水漫过指节，整段铜栏像被另一端敲响。七年前的米拉站在同一位置。
[米拉] [main] [急促却清醒]: "四十七个人，一个都不能从记录里消失。把罗盘送到瞭望台，让四座旧潮门重新看见彼此。"
她忽然转向你，像隔着七年看见了你。
[米拉] [main] [很轻]: "你真的回来了。"
[widget: tide-breath, remove: 14]
[state: value="登上潮钟瞭望台，看清四座旧潮门"]
[choices: "告诉尼洛你听见了什么"|"寻找第二段回声"|"先离开上涨的水面"]`, imagePrompt: 'cinematic coastal fantasy on a flooded customs stair, returning player gripping glowing copper rail, determined young woman in gate-worker coat visible only in water reflection, rooftop ferryman nearby, no text, no UI, 4:3' },
  { match: ['瞭望台', '四座', '高点', '登上', '离开上涨'], content: `你和尼洛穿过屋顶绳桥抵达潮钟瞭望台。逆潮罗盘落入中央刻槽，四条暗了七年的铜线依次指向灯塔区、沉水车站、雨棚市场和钟楼档案馆。它们没有替你选方向，只让每个远方都变得可达。
[map_update: new_location="潮钟瞭望台" connected_to="屋顶码头" detail="俯瞰四个城区的高台，中央刻槽已被罗盘唤醒" lore="旧守潮人曾让四座潮门在此共享水位" facts="灯塔区可走礁洞或借风|车站最低潮开放|市场准备涨潮宴|档案馆保存无钟之夜记录"]
[clock: value="归潮日 · 07:05 · 高潮"]
[widget: city-bond, add: 8]
[state: value="选择第一个调查区域，寻找零号潮门与四十七名失踪者"]
[session_end: reason="城市已经向你展开：四个区域都可以成为下一站，归乡冒险会从你的选择继续"]
[choices: "先去灯塔区"|"等最低潮进入沉水车站"|"选择雨棚市场、档案馆或其他路线"]`, imagePrompt: 'epic cinematic coastal fantasy overlook, traveler and rooftop ferryman above half-flooded city, four copper routes point to lighthouse, station, floating market and bell archive, no text, no UI, 4:3' },
]

const demoEn = [
  { match: ['road', 'compass', 'stone'], content: `You land on the wet road with the Foldtide Sail. The compass stops and copper seams begin to tremble.
A sharp whistle from the overturned skiff warns that the backflow is turning.
[skill_check: skill="Read the tide" dc="10" rolls="13" modifier="2" total="15" result="success"]
[clock: value="Homecoming · 05:55 · Lowest tide"]
[map_update: new_location="Exposed Tide Road" connected_to="Return Ferry" detail="Wet stone exposed at abnormal low tide, its copper resonating with the compass" lore="No current map records it" facts="Leads to the customs stair|Will vanish on rising tide"]
[widget: tide-breath, remove: 6]
[choices: "Listen at the copper seam"|"Answer the whistle by the skiff"|"Hurry down before the tide turns"]` },
  { match: ['rescue', 'person', 'backflow', 'pull'], content: `You swing beside the skiff. The person in the water flips himself aboard and frees the rope around your ankle.
[Nilo] [main] [laughing between breaths]: "Thanks. Half a breath later and I was doing that myself."
He is Nilo, a rooftop ferryman. The old road pushed the current upward.
[character_update: character_id="nilo" character="Nilo" role="Rooftop ferryman" detail="Righting his skiff in rope-clipped rain gear" lore="Knows outer-harbor water, rope and markets; talks fares first but leaves nobody in the water" vitality="86" stress="22" skills="Waterways: 4|Ropework: 3|Negotiation: 2"]
[reputation: npc="Nilo" action="helped"]
[widget: city-bond, add: 6]
[choices: "Play Mira's recording"|"Ask Nilo to approach the old road"|"Climb to the upper deck alone"]` },
  { match: ['upper deck', 'overview', 'look'], content: `Mist opens around Lighthouse Ward, the surfacing station, island-like Rain Market and a dark Bell Archive. The compass points only to a customs stair at the old road's end.
[map_update: new_location="Return Ferry · Upper Deck" connected_to="Return Ferry" detail="Observation roof overlooking the road and four districts" lore="Ferry crews judge the tide here" facts="The archive is dark|The station is surfacing|The road reaches customs"]
[choices: "Inspect the customs stair"|"Ask why the archive is dark"|"Signal the person by the skiff"]` },
  { match: ['recording', 'customs', 'crew'], content: `Nilo listens and studies the compass.
[Nilo] [main] [quietly]: "This city has no thirteenth bell. At least, that is what everyone alive says."
He offers a ride to customs. Fare can wait.
[character_update: character_id="nilo" character="Nilo" role="Rooftop ferryman" detail="Guiding his skiff toward abandoned customs" lore="Knows outer-harbor water, rope and markets" vitality="86" stress="28" skills="Waterways: 4|Ropework: 3|Negotiation: 2"]
[choices: "Invite Nilo along"|"Ask only for a landing"|"Ask what he knows of Mira"]` },
  { match: ['invite', 'together', 'come with'], content: `You hand Nilo the spare line. He stops mentioning fare.
[Nilo] [main] [too casually]: "I keep you from drowning; you explain the compass chasing dead promises."
[party_change: character_id="nilo" character="Nilo" change="add" role="Rooftop ferryman" detail="Reached customs with you, handling water and rope" lore="Knows outer-harbor water, rope and markets" vitality="86" stress="30" skills="Waterways: 4|Ropework: 3|Negotiation: 2"]
[map_update: new_location="Abandoned Customs Stair" connected_to="Exposed Tide Road" detail="Copper-railed stair with water rising step by step" lore="Customs closed seven years ago" facts="The rail holds an echo|The rooftop exit remains open"]
[clock: value="Homecoming · 06:18 · Rising tide"]
[choices: "Listen for Mira at the rail"|"Climb before the water rises"|"Light a Lamp Cell below the stair"]` },
  { match: ['Mira', 'echo', 'rail', 'copper'], content: `Water reaches your hand and the rail rings from its far end. Mira stands here seven years ago.
[Mira] [main] [urgent but steady]: "Forty-seven people. Not one disappears from the record. Bring the compass to the overlook and make the four gates see one another."
She turns as if she sees across seven years.
[Mira] [main] [softly]: "You really came back."
[widget: tide-breath, remove: 14]
[state: value="Reach Tidewatch Overlook and find the four old gates"]
[choices: "Tell Nilo what you heard"|"Search for a second echo"|"Get above the rising water"]`, imagePrompt: 'cinematic coastal fantasy on a flooded customs stair, returning player gripping glowing copper rail, determined young woman in gate-worker coat visible only in water reflection, rooftop ferryman nearby, no text, no UI, 4:3' },
  { match: ['overlook', 'four gates', 'high ground', 'climb', 'above the rising'], content: `You and Nilo cross rooftop bridges to Tidewatch Overlook. The compass enters a central slot and four copper lines wake toward Lighthouse Ward, Drowned Station, Rain Market and the Bell Archive. They choose nothing; they make every distance reachable.
[map_update: new_location="Tidewatch Overlook" connected_to="Rooftop Quay" detail="High platform overlooking four districts, awakened by the compass" lore="Tidekeepers once let four gates share pressure here" facts="Lighthouse by cave or wind|Station at lowest tide|Market prepares a feast|Archive keeps the official record"]
[clock: value="Homecoming · 07:05 · High tide"]
[widget: city-bond, add: 8]
[state: value="Choose a first district and find Gate Zero and the forty-seven missing people"]
[session_end: reason="The city has opened before you: any district can be next, and the homecoming continues from your choice"]
[choices: "Go to Lighthouse Ward"|"Wait for low tide and enter the station"|"Choose the market, archive or another route"]`, imagePrompt: 'epic cinematic coastal fantasy overlook, traveler and rooftop ferryman above half-flooded city, four copper routes point to lighthouse, station, floating market and bell archive, no text, no UI, 4:3' },
]

export const cityOfTides = build('zh')
export const cityOfTidesEn = build('en')
