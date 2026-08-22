import type { StoryCartridge, StoryImageDirector } from '../types'

const coverImage = new URL('../img/worlds/the-wild-road.webp', import.meta.url).href
const entryImage = new URL('../img/worlds/the-wild-road-entry.webp', import.meta.url).href

const shared = {
  schemaVersion: 1 as const,
  id: 'the-wild-road',
  coverImage,
  entryImage,
  theme: { outer: '#18211e', surface: '#202a26', paper: '#e5ddc8', ink: '#26342f', muted: '#737a70', accent: '#53705d', danger: '#a45443', gold: '#b77b3e', material: 'wayfarer' as const },
  itemImageDirection: 'wayfarer field-journal artifact study, linen, graphite, worn leather, iron and mineral pigments, quiet natural light, accessible classic fantasy realism',
  sceneImageDirection: 'accessible classic-fantasy travel illustration, dry-brush mineral pigments and graphite route lines on linen paper, clear landmarks, natural weather and light, slightly elevated three-quarter view',
  imageDirector: {
    maxQuietTurns: 3,
    softCooldownTurns: 2,
    guaranteedTriggers: ['new-location', 'rare-item', 'party-change', 'chapter-checkpoint'],
    softTriggers: ['relationship-change', 'objective-change', 'skill-outcome'],
  } satisfies StoryImageDirector,
  audioTheme: {
    material: 'wayfarer' as const, bpm: 56, rootHz: 146.83, scale: [0, 2, 5, 7, 9],
    levels: { music: .16, ambient: .14, sfx: .045, master: .48 },
    tension: [
      { statId: 'vitality', direction: 'low' as const, weight: .45 },
      { statId: 'supplies', direction: 'low' as const, weight: .35 },
      { statId: 'renown', direction: 'low' as const, weight: .2 },
    ],
  },
}

export const theWildRoad: StoryCartridge = {
  ...shared,
  locale: 'zh',
  copy: {
    title: '旷野之路', subtitle: '一张由脚步画出的地图',
    promise: '没有规定你该去哪里。世界会沿着你选择的道路生长。',
    enter: '走向十字路口', continue: '继续这段旅程', customAction: '也可以写下任何想做的事',
    itemImagingTitle: '旅记正在描摹行囊', itemImagingBody: '你把行囊摊在旧地图旁，旅记开始用这片旷野的纸纹、矿物色与自然光描下每件东西。其余物品会在赶路时静静成形。',
  },
  director: {
    mode: 'open-world',
    fixedWorldRules: [
      '这是一个大众熟悉的经典奇幻大陆，使用村庄、森林、山路、河流、旅店、商队、遗迹、野兽与少量魔法，不堆叠专业设定或陌生专有名词。',
      '玩家是普通旅行者，不是预设的天选之人；不存在必须追随的救世主主线。',
      '道路、距离、时间和物资符合常识；已确认的地点、人物、物品归属与事件后果不能被静默改写。',
      '魔法稀少、具体且有代价；宝物不能无限复制，也不能无理由解决所有问题。',
      'NPC 只知道自己有机会知道的事实，并记得玩家对他们做过的重要事情。',
    ],
    generationRules: [
      '允许自由生成未探索地点的局部细节、新 NPC、传闻、天气、小型冲突、任务机会和普通物资。',
      '每轮至少改变一个可追踪事实，不能连续只写气氛；移动、休息、等待或长行动要推进时间。',
      '玩家可以离开建议路线、返回旧地点、长期停留、经商、结伴、帮助、偷窃、逃跑或追逐自定目标。',
      '稀有及以上宝物必须先在正文说明明确能力、限制或代价以及可追溯来源，再写入行囊。',
      '失败产生受伤、损失、追捕、债务、救援或路线变化，不以删除存档作为惩罚。',
    ],
    choiceIntents: ['观察或交涉', '移动或探索', '承担风险或另辟蹊径'],
    maxActiveThreads: 3,
  },
  statDefinitions: [
    { id: 'vitality', label: '体力', min: 0, max: 100, initial: 82, inverse: true, display: 'bar', warningAt: 25, dangerAt: 0, maxDelta: 25 },
    { id: 'supplies', label: '补给', min: 0, max: 12, initial: 7, inverse: true, display: 'number', warningAt: 3, dangerAt: 0, maxDelta: 4 },
    { id: 'renown', label: '名望', min: -100, max: 100, initial: 0, inverse: true, display: 'bar', warningAt: -40, dangerAt: -80, maxDelta: 15 },
  ],
  drawerLabels: { party: '旅伴', map: '地图', inventory: '行囊', log: '旅记' },
  opening: {
    location: '旧十字路口', time: '初夏第 1 天 · 08:10', objective: '选择一条路，找到今晚愿意停留的地方',
    imagePrompt: 'empty ancient countryside crossroads at early summer dawn, three clear roads toward a gray-roof village, a deep green forest and wind-carved hills with a ruined watchtower, a weathered iron key and folded map on a milestone in the foreground, accessible classic fantasy, elegant editorial travel illustration, dry brush mineral pigments and graphite route lines on linen paper, slightly elevated three-quarter view, no people, no text, no letters, no UI, 4:3',
    blocks: [
      { id: 'w0', kind: 'narration', text: '旧路碑把大陆分成三个方向。东边的炊烟刚刚升起；西边的树林还留着夜里的雾；北面的丘陵上，一座缺了半边的塔正接住第一束阳光。' },
      { id: 'w1', kind: 'narration', text: '你没有必须完成的使命。行囊里只有够走几天的东西，以及一把没人认领、也没有锁与它相配的旧钥匙。' },
      { id: 'w2', kind: 'event', text: '短期目标：在天黑前决定在哪里落脚。你也可以不走任何一条建议的路。' },
    ],
    choices: [
      { id: 'village', label: '沿炊烟去东面的灰瓦村' },
      { id: 'forest', label: '循着鹿蹄印进入西面的树林' },
      { id: 'hills', label: '向北登上能看见旧塔的丘陵' },
    ],
  },
  characters: [],
  initialMap: [
    { id: 'crossroads', label: '旧十字路口', current: true, detail: '一块风化路碑把古道分成东、西、北三条，路旁有可供短歇的干燥石台。', lore: '商路改道后，旧十字路口不再有人收税，也没人负责修补路标。', facts: ['东边能看见村庄炊烟', '西边鹿蹄印进入林中', '北面丘陵有半座旧塔'] },
    { id: 'gray-village', label: '灰瓦村方向', connectedTo: '旧十字路口', detail: '相对平坦的东路，田埂和炊烟说明一小时内有人居住。', lore: '灰瓦村靠给商队修车和晒谷维生，陌生人常能找到床位，也会被问清来路。', facts: ['道路适合车马', '清晨已有炊烟'] },
    { id: 'antler-wood', label: '鹿角林方向', connectedTo: '旧十字路口', detail: '西路进入潮湿阔叶林，鹿蹄印与较新的靴印在林缘重叠。', lore: '猎人把这片林子叫鹿角林，因为旧枝在雾里像成群的角。', facts: ['林中可听见溪水', '地图没有标出内部岔路'] },
    { id: 'wind-hills', label: '风蚀丘陵方向', connectedTo: '旧十字路口', detail: '北路较陡，沿裸露岩脊通往能俯瞰三条道路的旧塔。', lore: '塔曾为驿路点灯，战争结束后火盆再没有正式点燃。', facts: ['视野最好', '路上缺少稳定水源'] },
  ],
  initialInventory: [
    { id: 'knife', label: '旧短刀', count: 1, detail: '磨过很多次的直刃短刀，木柄末端有一道烧痕。', effect: '切绳、削木和近身自卫；刀刃偏薄，不适合撬门或对抗重甲。', lore: '普通旅人都会带的工具，烧痕说明它曾从一场营火事故里被捡回来。', metrics: [{ label: '刃长', value: '18 厘米' }, { label: '耐用', value: '6 / 10' }], imagePrompt: 'single worn traveler short knife with repeatedly sharpened straight blade and a burn mark on wooden pommel, linen field journal still life, object only, no text, square' },
    { id: 'rope', label: '麻绳', count: 1, detail: '十二米干燥麻绳，结实但已经起毛。', effect: '可攀越矮崖、固定行李或制作简易陷阱；潮湿后承重会下降。', lore: '绳子来自南方集市，纤维里仍夹着晒谷场的红色尘土。', metrics: [{ label: '长度', value: '12 米' }, { label: '安全负重', value: '120 千克' }], imagePrompt: 'single coil of worn twelve meter hemp rope with reddish market dust in the fibers, classic wayfarer artifact study, object only, no text, square' },
    { id: 'tinderbox', label: '火绒盒', count: 1, detail: '装着燧石、火钢和干燥桦皮的扁铁盒。', effect: '在避风处可靠生火；暴雨中必须先找到干燥遮蔽。', lore: '盒盖内侧的五道刻痕不是装饰，而是前任主人走过的五个冬天。', metrics: [{ label: '火绒', value: '约 9 次' }, { label: '状态', value: '干燥' }], imagePrompt: 'single flat iron tinderbox open to reveal flint steel and dry birch bark, five notches inside lid, wayfarer still life, object only, no text, square' },
    { id: 'coins', label: '银币', count: 18, detail: '不同城镇铸造、重量相近的一小袋旧银币。', effect: '可支付约三晚普通床位或数日基础食物；偏远地区可能按重量而非面值收取。', lore: '旧王徽已经磨平，仍被接受，因为银本身比王朝活得更久。', metrics: [{ label: '总重', value: '约 210 克' }, { label: '购买力', value: '3 晚床位' }], imagePrompt: 'small leather pouch spilling eighteen worn mixed silver coins with unreadable faces, linen and graphite field journal still life, object only, no text, square' },
    { id: 'iron-key', label: '没有标记的铁钥匙', count: 1, rarity: 'rare', detail: '掌心长的黑铁钥匙，齿形过于复杂，不像普通门锁。', effect: '尚未找到对应的锁；钥匙靠近旧驿路石标时会变得微温。', lore: '没有工匠印记，但匙环的三岔纹样与旧十字路口的道路布局相同。', metrics: [{ label: '长度', value: '11 厘米' }, { label: '线索', value: '三岔纹样' }], imagePrompt: 'single mysterious unmarked black iron key with complex teeth and a three-way fork motif on the ring, worn linen map beneath, rare classic fantasy artifact, object only, no text, square' },
  ],
  demoTurns: [
    {
      match: ['树林', '鹿蹄', '西面', 'forest', 'tracks'],
      content: `你沿着鹿蹄印离开大路。林下的雾并不深，但每一块被翻开的苔藓都说明，有人比你早一步走过这里。
[skill_check: skill="观察" dc="11" rolls="14" modifier="2" total="16" result="success"]
你在倒木背面发现一个猎人留下的方向记号。它没有指向林外，而是指向一条地图上不存在的溪谷。
[clock: value="初夏第 1 天 · 09:05"]
[widget: supplies, value: 6]
[state: value="决定是否沿猎人的记号寻找无名溪谷"]
[choices: "先检查记号是不是刚刻下的"|"沿记号深入树林"|"绕开记号，顺着溪水声自己找路"]`,
    },
    {
      match: ['深入', '溪水', '记号', '检查'],
      content: `记号只刻了两天。你顺着它穿过一片倒伏的白桦，在午前抵达一条狭长溪谷。
[map_update: new_location="无名溪谷" connected_to="旧十字路口"]
[clock: value="初夏第 1 天 · 11:40"]
溪边废弃的石龛里嵌着一块透明薄片。它能让持有者在黄昏前看见最近有人走过的脚印，但每次使用都会让薄片多出一道无法修复的裂纹。石龛下刻着旧驿站守路人的徽记。
[inventory: action="add" item="守路人的路镜" count="1" rarity="rare" detail="嵌在旧铜框里的透明薄片，已有一道发丝裂纹" effect="黄昏前显出附近最新脚印；每次使用都会增加一道无法修复的裂纹" lore="旧驿站守路人用它确认风雪后的道路是否有人通过，石龛徽记证明其来源" metrics="剩余完整度: 4 次左右|有效范围: 约 60 米" image_prompt="single translucent cracked pathglass sliver in an old copper road-keeper frame, one hairline fracture, linen and mineral pigment artifact study, object only, no text, square"]
[choices: "用路镜查看猎人去了哪里"|"不使用路镜，搜索溪谷里的旧驿站"|"带着路镜返回十字路口寻找认识徽记的人"]`,
      imagePrompt: 'hidden narrow creek valley in a familiar classic fantasy forest, abandoned roadside shrine holding a translucent cracked path-glass relic, winding footpath and clear landmarks, elegant editorial travel illustration, dry brush mineral pigments and graphite route lines on linen paper, soft late morning light, no readable text, no UI, 4:3',
    },
    {
      match: ['路镜', '驿站', '返回', '溪谷'],
      content: `你把无名溪谷、守路人的徽记和路镜的第一道细裂写进旅记。这里没有要求你立刻追上任何人；通往森林深处的脚印、灰瓦村的炊烟和北方旧塔仍然都在。
[session_end: reason="你发现了第一处地图之外的地点和一件有代价的遗物；这段旅程随时可以继续"]`,
    },
  ],
}

export const theWildRoadEn: StoryCartridge = {
  ...shared,
  locale: 'en',
  copy: {
    title: 'The Wild Road', subtitle: 'A map drawn by your footsteps',
    promise: 'No one tells you where to go. The world grows along the roads you choose.',
    enter: 'Walk to the crossroads', continue: 'Continue the journey', customAction: 'Or write anything you want to do',
    itemImagingTitle: 'The journal is tracing your pack', itemImagingBody: 'You lay the pack beside the old map. Each object begins taking shape in this road’s linen grain, mineral color, and natural light; the remaining plates will develop quietly as you travel.',
  },
  director: {
    mode: 'open-world',
    fixedWorldRules: [
      'This is familiar classic fantasy built from villages, forests, roads, rivers, inns, caravans, ruins, beasts, monsters, and scarce magic. Avoid specialist lore and dense invented terminology.',
      'The player is an ordinary traveler, not a predetermined chosen one. There is no mandatory save-the-world plot.',
      'Roads, distance, time, and supplies obey common sense. Confirmed places, people, ownership, and consequences cannot be silently rewritten.',
      'Magic is scarce, concrete, and costly. Treasure cannot be copied without limit or solve every problem without cause.',
      'NPCs know only what they could reasonably know and remember important help, deception, bargains, injuries, and promises.',
    ],
    generationRules: [
      'Freely create local details of unexplored places, new NPCs, rumors, weather, small conflicts, opportunities, and ordinary supplies.',
      'Every turn changes at least one trackable fact; never write atmosphere alone twice. Travel, rest, waiting, and long actions advance time.',
      'The player may leave suggested routes, revisit places, settle down, trade, recruit, help, steal, flee, or pursue a self-chosen goal.',
      'Before adding rare or legendary treasure, state its concrete ability, limitation or cost, and traceable source in visible prose.',
      'Failure creates injury, loss, pursuit, debt, rescue, or route changes. It never deletes the save.',
    ],
    choiceIntents: ['observe or negotiate', 'travel or explore', 'take a risk or find another way'],
    maxActiveThreads: 3,
  },
  statDefinitions: [
    { id: 'vitality', label: 'Vitality', min: 0, max: 100, initial: 82, inverse: true, display: 'bar', warningAt: 25, dangerAt: 0, maxDelta: 25 },
    { id: 'supplies', label: 'Supplies', min: 0, max: 12, initial: 7, inverse: true, display: 'number', warningAt: 3, dangerAt: 0, maxDelta: 4 },
    { id: 'renown', label: 'Renown', min: -100, max: 100, initial: 0, inverse: true, display: 'bar', warningAt: -40, dangerAt: -80, maxDelta: 15 },
  ],
  drawerLabels: { party: 'Companions', map: 'Map', inventory: 'Pack', log: 'Journal' },
  opening: {
    location: 'Old Crossroads', time: 'Early summer · Day 1 · 08:10', objective: 'Choose a road and find somewhere you would stay tonight',
    imagePrompt: 'empty ancient countryside crossroads at early summer dawn, three clear roads toward a gray-roof village, a deep green forest and wind-carved hills with a ruined watchtower, a weathered iron key and folded map on a milestone in the foreground, accessible classic fantasy, elegant editorial travel illustration, dry brush mineral pigments and graphite route lines on linen paper, slightly elevated three-quarter view, no people, no text, no letters, no UI, 4:3',
    blocks: [
      { id: 'w0', kind: 'narration', text: 'The old milestone divides the continent three ways. Smoke rises in the east; the western woods still hold the night mist; on the northern hills, a half-ruined tower catches the first light.' },
      { id: 'w1', kind: 'narration', text: 'You have no mission you must complete. Your pack holds only a few days of necessities and an old, unclaimed key with no known lock.' },
      { id: 'w2', kind: 'event', text: 'Short-term aim: decide where to rest before dark. You do not have to follow any suggested road.' },
    ],
    choices: [
      { id: 'village', label: 'Follow the smoke east toward Graytile Village' },
      { id: 'forest', label: 'Follow deer tracks into the western woods' },
      { id: 'hills', label: 'Climb north toward the ruined tower' },
    ],
  },
  characters: [],
  initialMap: [
    { id: 'crossroads', label: 'Old Crossroads', current: true, detail: 'A weathered milestone divides the old road east, west, and north beside a dry stone resting ledge.', lore: 'When trade moved elsewhere, no one remained to collect tolls—or repair the signs.', facts: ['Village smoke is visible east', 'Deer tracks enter the western woods', 'Half a tower stands on the northern hills'] },
    { id: 'gray-village', label: 'Road to Graytile Village', connectedTo: 'Old Crossroads', detail: 'A level eastern road. Fields and smoke place habitation within an hour.', lore: 'Graytile lives by repairing wagons and drying grain. Strangers usually find a bed and many questions.', facts: ['Suitable for carts', 'Cookfires are already lit'] },
    { id: 'antler-wood', label: 'Road to Antler Wood', connectedTo: 'Old Crossroads', detail: 'The western road enters damp broadleaf forest where deer and recent boot prints overlap.', lore: 'Hunters named it for old branches that resemble antlers in the mist.', facts: ['Running water can be heard', 'No inner forks appear on the map'] },
    { id: 'wind-hills', label: 'Road to the Windworn Hills', connectedTo: 'Old Crossroads', detail: 'A steep northern road follows exposed ridges toward a tower overlooking all three routes.', lore: 'The tower once lit the post road. Its official beacon has not burned since the war.', facts: ['Best visibility', 'No reliable water along the ridge'] },
  ],
  initialInventory: [
    { id: 'knife', label: 'Old short knife', count: 1, detail: 'A repeatedly sharpened straight blade with a burn mark on its wooden pommel.', effect: 'Cuts rope, shapes wood, and serves in close defense; too thin for prying doors or heavy armor.', lore: 'A common traveler’s tool. The burn mark says it was recovered from a campfire accident.', metrics: [{ label: 'Blade', value: '18 cm' }, { label: 'Durability', value: '6 / 10' }], imagePrompt: 'single worn traveler short knife with repeatedly sharpened straight blade and a burn mark on wooden pommel, linen field journal still life, object only, no text, square' },
    { id: 'rope', label: 'Hemp rope', count: 1, detail: 'Twelve meters of dry hemp, strong but beginning to fray.', effect: 'Crosses a low cliff, secures luggage, or makes a simple snare; loses strength when soaked.', lore: 'Bought in a southern market, its fibers still hold red dust from the grain yard.', metrics: [{ label: 'Length', value: '12 m' }, { label: 'Safe load', value: '120 kg' }], imagePrompt: 'single coil of worn twelve meter hemp rope with reddish market dust in the fibers, classic wayfarer artifact study, object only, no text, square' },
    { id: 'tinderbox', label: 'Tinderbox', count: 1, detail: 'A flat iron box containing flint, steel, and dry birch bark.', effect: 'Reliably starts a sheltered fire; heavy rain still requires dry cover first.', lore: 'Five notches inside the lid mark five winters survived by its former owner.', metrics: [{ label: 'Tinder', value: 'About 9 fires' }, { label: 'Condition', value: 'Dry' }], imagePrompt: 'single flat iron tinderbox open to reveal flint steel and dry birch bark, five notches inside lid, wayfarer still life, object only, no text, square' },
    { id: 'coins', label: 'Silver coins', count: 18, detail: 'A small purse of old silver from different towns, all similar in weight.', effect: 'Pays for roughly three ordinary nights or several days of staples; remote places may weigh it.', lore: 'The royal faces are worn away, but silver outlives dynasties.', metrics: [{ label: 'Weight', value: 'About 210 g' }, { label: 'Buying power', value: '3 nights' }], imagePrompt: 'small leather pouch spilling eighteen worn mixed silver coins with unreadable faces, linen and graphite field journal still life, object only, no text, square' },
    { id: 'iron-key', label: 'Unmarked iron key', count: 1, rarity: 'rare', detail: 'A palm-long black iron key with teeth too complex for an ordinary door.', effect: 'Its lock is unknown; it grows faintly warm near old post-road milestones.', lore: 'It bears no smith mark, but the three-fork motif on its ring mirrors the Old Crossroads.', metrics: [{ label: 'Length', value: '11 cm' }, { label: 'Clue', value: 'Three-fork motif' }], imagePrompt: 'single mysterious unmarked black iron key with complex teeth and a three-way fork motif on the ring, worn linen map beneath, rare classic fantasy artifact, object only, no text, square' },
  ],
  demoTurns: [
    {
      match: ['woods', 'deer', 'west', 'forest', 'tracks'],
      content: `You leave the road along the deer tracks. The mist is shallow, but every patch of turned moss says someone passed this way before you.
[skill_check: skill="Observe" dc="11" rolls="14" modifier="2" total="16" result="success"]
Behind a fallen trunk, you find a hunter's trail mark. It points not out of the woods but toward a valley absent from your map.
[clock: value="Early summer · Day 1 · 09:05"]
[widget: supplies, value: 6]
[state: value="Decide whether to follow the hunter's mark toward the nameless valley"]
[choices: "Check whether the mark was cut recently"|"Follow the mark deeper into the woods"|"Ignore it and find your own way by the sound of water"]`,
    },
    {
      match: ['deeper', 'water', 'mark', 'check'],
      content: `The mark is only two days old. You follow it through fallen birches and reach a narrow creek valley before noon.
[map_update: new_location="Nameless Valley" connected_to="Old Crossroads"]
[clock: value="Early summer · Day 1 · 11:40"]
An abandoned wayside shrine holds a translucent sliver. It reveals the freshest footprints nearby until dusk, but every use adds one irreparable crack. The shrine bears the old road-keepers' emblem.
[inventory: action="add" item="Road-keeper's Pathglass" count="1" rarity="rare" detail="A translucent sliver in an old copper frame, already bearing one hairline crack" effect="Reveals the freshest nearby footprints before dusk; every use adds one irreparable crack" lore="Road-keepers used it to confirm passage after storms, and the shrine emblem traces its source" metrics="Integrity: about 4 uses|Range: about 60 m" image_prompt="single translucent cracked pathglass sliver in an old copper road-keeper frame, one hairline fracture, linen and mineral pigment artifact study, object only, no text, square"]
[choices: "Use the pathglass to see where the hunter went"|"Leave it unused and search for the old waystation"|"Return to the crossroads and find someone who knows the emblem"]`,
      imagePrompt: 'hidden narrow creek valley in a familiar classic fantasy forest, abandoned roadside shrine holding a translucent cracked path-glass relic, winding footpath and clear landmarks, elegant editorial travel illustration, dry brush mineral pigments and graphite route lines on linen paper, soft late morning light, no readable text, no UI, 4:3',
    },
    {
      match: ['pathglass', 'waystation', 'return', 'valley'],
      content: `You enter the Nameless Valley, the road-keeper's emblem, and the first hairline crack in the pathglass into your journal. Nothing demands that you pursue anyone now. The forest tracks, Graytile's smoke, and the northern tower all remain.
[session_end: reason="You found the first place beyond your map and a relic with a cost; this journey can continue at any time"]`,
    },
  ],
}
