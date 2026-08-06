import { useCallback, useState } from 'react'
import type { CommitCode, Locale, RegionId, TraceKind } from './types'

const copy = {
  zh: {
    lab: '异步共享世界 · 本地四旅人模拟', title: '潮痕之城', subtitle: '城市替不同时抵达的人保存一段迟到的对话',
    season: '潮汐季', tide: '潮位', travellers: '近期旅人', traces: '有效潮痕', version: '世界版本',
    world: '世界', regions: '城市区域', pack: '行囊', current: '当前区域', worldTrace: '潮痕记录', maxSix: '现场只显露最近六道有效潮痕',
    entryEyebrow: '一个会被后来者改变的异步世界', coverAlt: '潮痕之城：灯塔与潮水中的城市', enterCity: '走进潮痕之城', enterLoading: '正在听城市醒来…',
    worldBackground: '世界背景', worldBackgroundTitle: '退潮之后，城市会记住人们做过的事', worldBackgroundBodyA: '潮痕之城每天有一半时间浸在海里。道路、市场和档案馆会随潮水改变，来到这里的人却很少同时相遇。', worldBackgroundBodyB: '你可以读取前人留下的警告、路线和物资，也能让自己的行动暂时改变一个区域。少数被许多人共同完成的改变，会跨过潮汐季，成为这座城市永久的一部分。',
    regionNow: '当前区域发生了什么', tracesSection: '其他玩家留下的痕迹', tracesSectionHint: '潮水只显露这里最近六道仍然有效的痕迹。', actionsSection: '你的行动', actionsSectionHint: '普通行动点击一次就会写入世界；留言才需要输入文字。', actionPending: '正在写入…', cancelMessage: '收起留言',
    introText: '潮水退去后，最近来访者的声音仍附着在湿石和铜器上。', anchorEvent: '这项改变已经跨过一次潮汐季，成为城市历史。', seasonExplanation: '不同时间抵达的旅人可以各贡献一次；完成后会在季节结算时成为永久锚点候选。', customPlaceholder: '说说你想怎么做…',
    empty: '这里暂时没有留下来的声音。', leaveFirst: '留下第一道潮痕', hoursLeft: '约 {n} 小时后被潮水冲淡', anchored: '本季已锚定',
    replies: '{n} 人加固', reinforcement: '加固人数', charges: '剩余 {n} 份', claimed: '你已领取', reply: '回应', reinforce: '加固', claim: '领取一份', report: '举报', reportSaved: '举报已进入城市档案；三位不同旅人举报后，这道潮痕会被隐藏。', detail: '查看痕迹', close: '关闭',
    leaveTraceShort: '留下潮痕',
    act: '给后来者留下什么', actHint: '选择一种有明确时效的帮助，或者只留一句话。', messageLabel: '留给后来者的话', messagePlaceholder: '最多 120 字…',
    submit: '写入这道潮痕', cancel: '取消', effect: '状态影响', lifetime: '有效时间', noEffect: '只传递信息',
    project: '本季共同工程', contribute: '贡献 25 点', contributed: '本季已经贡献', contributors: '{n} 位参与者', complete: '工程完成，等待季节结算',
    anchors: '永久锚点', noAnchors: '还没有跨越潮汐季留下的永久改变。', resolve: '模拟季节结算', nextTraveller: '换一位后来者', activeAs: '当前模拟身份',
    gateway: '数据通道', localGateway: 'Local Gateway · 不写入 Aigram', remoteGateway: 'Staging Gateway · 共享世界已连接', reset: '恢复初始实验', resetQuestion: '清除当前实验世界并恢复初始城市？', conflict: '模拟旧版本冲突', experiment: '实验控制',
    contributorUnit: '位参与者',
    saved: '潮痕已写入公共账本。', duplicate: '重复行动已被忽略。', versionConflict: '世界已经变化；正在同步最新状态。',
    unavailable: '这份援助已经被其他旅人领完。', expired: '这道潮痕已经被水冲散。', alreadySupported: '你已经加固过这道潮痕。', alreadyContributed: '同一旅人每季只能为该工程贡献一次。', authRequired: '访客可以阅读，但登录后才能改变共享世界。', rateLimited: '潮水需要一点时间记录这次行动，请稍后再试。', genericError: '行动未能写入世界。', resetDone: '实验世界已恢复。',
    sound: '声音', muted: '静音', language: '切换语言', you: '你', simulated: '模拟旅人', permanent: '永久', publicAid: '公共援助',
    packEmpty: '还没有从公共援助中带走任何东西。', packUnavailable: '在 AlterU 正式身份中打开后，公共援助才会写入你的个人行囊。', retryGrantSync: '重新确认存档', grant_idle: '个人存档已就绪', grant_syncing: '正在把新物品写入个人云存档…', grant_saved: '物品已写入个人云存档', grant_pending: '网络尚未确认，回执会在下次进入时继续补偿', grant_error: '暂时无法同步，公共回执仍被保留', grant_unavailable: '当前是只读或实验身份', item_lamp_cell: '密封灯芯', itemFallback: '来自公共援助的物品', quantity: '数量 ×{n}',
    region_lighthouse: '灯塔区', region_station: '沉水车站', region_market: '雨棚市场', region_archive: '钟楼档案馆',
    regionDesc_lighthouse: '光决定夜里哪些道路仍能被看见。', regionDesc_station: '旧站台之间的通道会随潮水出现或消失。', regionDesc_market: '陌生人把可共享的东西留在铜制柜台下。', regionDesc_archive: '能跨越季节的事实必须在钟声前被保存。',
    status_submerged: '被潮水吞没', status_fragile: '脆弱', status_recovering: '正在恢复', status_revived: '本次潮汐复苏',
    trace_message: '留下一句话', trace_warning: '发出警告', trace_aid: '留下公共援助', trace_repair: '修复一处设施', trace_route: '标记安全路线',
    kind_message: '留言', kind_warning: '警告', kind_aid: '公共援助', kind_repair: '维修', kind_route: '路线',
    ttl_message: '48 小时', ttl_warning: '72 小时', ttl_aid: '96 小时', ttl_repair: '7 天', ttl_route: '7 天',
    project_lighthouse: '让灯塔重新照亮外港', project_station: '抬高通往四号站台的堤道', project_market: '恢复雨棚市场的公共补给', project_archive: '封存本季城市档案',
    anchor_lighthouse: '记得一切的灯塔', anchor_station: '被抬高的堤道', anchor_market: '雨中的市场', anchor_archive: '潮线之上的档案',
  },
  en: {
    lab: 'ASYNC SHARED WORLD · FOUR-TRAVELLER LOCAL SIM', title: 'CITY OF TIDES', subtitle: 'The city carries a late conversation between people who never arrived together',
    season: 'Tide season', tide: 'Tide', travellers: 'Recent travellers', traces: 'Active traces', version: 'World version',
    world: 'World', regions: 'City districts', pack: 'Pack', current: 'Current district', worldTrace: 'Tide traces', maxSix: 'Only the six latest active traces remain on site',
    entryEyebrow: 'AN ASYNCHRONOUS WORLD CHANGED BY THOSE WHO FOLLOW', coverAlt: 'City of Tides: a lighthouse above a flooded city', enterCity: 'Enter the City of Tides', enterLoading: 'Listening for the city…',
    worldBackground: 'World background', worldBackgroundTitle: 'After the tide, the city remembers what people did', worldBackgroundBodyA: 'The City of Tides spends half of every day beneath the sea. Roads, markets, and archives change with the water, while its visitors rarely arrive at the same time.', worldBackgroundBodyB: 'You can read warnings, routes, and supplies left by earlier travellers, then let your own action change a district for a while. A few changes completed by many people survive the season and become permanent parts of the city.',
    regionNow: 'What is happening here', tracesSection: 'Traces left by other players', tracesSectionHint: 'The tide reveals only the six latest traces that still remain here.', actionsSection: 'Your action', actionsSectionHint: 'Ordinary actions enter the world in one click. Only a message asks you to write.', actionPending: 'Writing…', cancelMessage: 'Close message',
    introText: 'When the tide withdrew, recent visitors’ voices remained on wet stone and copper.', anchorEvent: 'This change survived a tide season and entered the city’s history.', seasonExplanation: 'Travellers arriving at different times may contribute once; completion becomes a permanent-anchor candidate at season resolution.', customPlaceholder: 'Say what you want to do…',
    empty: 'No voice has held here yet.', leaveFirst: 'Leave the first trace', hoursLeft: 'About {n} hours before the tide fades it', anchored: 'Anchored this season',
    replies: '{n} reinforced', reinforcement: 'Reinforcements', charges: '{n} shares left', claimed: 'Claimed by you', reply: 'Reply', reinforce: 'Reinforce', claim: 'Claim one', report: 'Report', reportSaved: 'Report entered the city ledger. Three distinct reports hide this trace.', detail: 'View trace', close: 'Close',
    leaveTraceShort: 'Leave a trace',
    act: 'What will you leave behind?', actHint: 'Choose a time-limited aid, or simply leave a line.', messageLabel: 'Words for the next visitor', messagePlaceholder: 'Up to 120 characters…',
    submit: 'Commit this trace', cancel: 'Cancel', effect: 'State effect', lifetime: 'Lifetime', noEffect: 'Information only',
    project: 'This season’s work', contribute: 'Contribute 25', contributed: 'Already contributed', contributors: '{n} contributors', complete: 'Complete; awaiting season resolution',
    anchors: 'Permanent anchors', noAnchors: 'No change has survived across a tide season yet.', resolve: 'Simulate season resolution', nextTraveller: 'Switch to a later visitor', activeAs: 'Simulated as',
    gateway: 'Data channel', localGateway: 'Local Gateway · no Aigram writes', remoteGateway: 'Staging Gateway · shared world connected', reset: 'Restore initial experiment', resetQuestion: 'Clear this experiment world and restore the initial city?', conflict: 'Simulate stale version', experiment: 'Experiment controls',
    contributorUnit: 'contributors',
    saved: 'The trace entered the public ledger.', duplicate: 'Duplicate action ignored.', versionConflict: 'The world changed; syncing its latest state.',
    unavailable: 'Another traveller took the last share.', expired: 'The tide has already erased this trace.', alreadySupported: 'You already reinforced this trace.', alreadyContributed: 'Each traveller can contribute once per project per season.', authRequired: 'Guests may read, but must sign in to change the shared world.', rateLimited: 'The tide needs a moment to record this action. Try again shortly.', genericError: 'The action did not enter the world.', resetDone: 'The experiment world was restored.',
    sound: 'Sound', muted: 'Muted', language: 'Switch language', you: 'You', simulated: 'Simulated traveller', permanent: 'Permanent', publicAid: 'Public aid',
    packEmpty: 'You have not carried anything away from public aid yet.', packUnavailable: 'Open with an AlterU identity before public aid can enter your personal pack.', retryGrantSync: 'Verify save again', grant_idle: 'Personal save ready', grant_syncing: 'Writing the new item to your personal cloud save…', grant_saved: 'Item saved to your personal cloud save', grant_pending: 'The network has not confirmed it yet; the receipt will retry next time', grant_error: 'Sync is unavailable; the public receipt is still preserved', grant_unavailable: 'Read-only or experiment identity', item_lamp_cell: 'Sealed lamp cell', itemFallback: 'Item from public aid', quantity: 'Quantity ×{n}',
    region_lighthouse: 'Lighthouse Ward', region_station: 'Drowned Station', region_market: 'Rain Market', region_archive: 'Bell Archive',
    regionDesc_lighthouse: 'Light decides which roads can still be seen at night.', regionDesc_station: 'Passages between old platforms surface and vanish with the tide.', regionDesc_market: 'Strangers leave shared things beneath the copper counter.', regionDesc_archive: 'Facts that cross seasons must be sealed before the bells.',
    status_submerged: 'Submerged', status_fragile: 'Fragile', status_recovering: 'Recovering', status_revived: 'Revived this tide',
    trace_message: 'Leave a message', trace_warning: 'Post a warning', trace_aid: 'Leave public aid', trace_repair: 'Repair a fixture', trace_route: 'Mark a safe route',
    kind_message: 'Message', kind_warning: 'Warning', kind_aid: 'Public aid', kind_repair: 'Repair', kind_route: 'Route',
    ttl_message: '48 hours', ttl_warning: '72 hours', ttl_aid: '96 hours', ttl_repair: '7 days', ttl_route: '7 days',
    project_lighthouse: 'Relight the outer harbour beacon', project_station: 'Raise the causeway to platform four', project_market: 'Restore the rain market’s common stores', project_archive: 'Seal this season’s city ledger',
    anchor_lighthouse: 'The Beacon That Remembered', anchor_station: 'The Raised Causeway', anchor_market: 'The Market Under Rain', anchor_archive: 'The Ledger Above the Tide',
  },
} as const

export type CopyKey = keyof typeof copy.zh

function detectLocale(): Locale {
  const stored = localStorage.getItem('game_locale')
  if (stored === 'zh' || stored === 'en') return stored
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export function useCityI18n() {
  const [locale, setLocaleState] = useState<Locale>(detectLocale)
  const setLocale = useCallback((next: Locale) => { localStorage.setItem('game_locale', next); setLocaleState(next) }, [])
  const t = useCallback((key: CopyKey, vars?: Record<string, string | number>) => {
    let value: string = copy[locale][key]
    for (const [name, replacement] of Object.entries(vars || {})) value = value.replace(`{${name}}`, String(replacement))
    return value
  }, [locale])
  return { locale, setLocale, t }
}

export const regionKey = (id: RegionId): CopyKey => `region_${id}` as CopyKey
export const regionDescKey = (id: RegionId): CopyKey => `regionDesc_${id}` as CopyKey
export const projectKey = (id: RegionId): CopyKey => `project_${id}` as CopyKey
export const anchorKey = (id: RegionId): CopyKey => `anchor_${id}` as CopyKey
export const traceActionKey = (kind: TraceKind): CopyKey => `trace_${kind}` as CopyKey
export const traceKindKey = (kind: TraceKind): CopyKey => `kind_${kind}` as CopyKey
export const traceTtlKey = (kind: TraceKind): CopyKey => `ttl_${kind}` as CopyKey
export const statusKey = (status: string): CopyKey => `status_${status}` as CopyKey
export const grantStatusKey = (status: string): CopyKey => `grant_${status}` as CopyKey
export const inventoryItemKey = (kind: string): CopyKey | null => kind === 'lamp_cell' ? 'item_lamp_cell' : null

const demoTraceZh: Record<string, string> = {
  'The third bell arrived before the water rose. Do not trust the lower stairs.': '水涨之前第三声钟就响了。不要走下面的楼梯。',
  'Blue chalk marks a dry passage behind platform four.': '蓝色粉笔标出了四号站台后方的一条干燥通道。',
  'Three sealed lamp cells are under the copper counter.': '三枚密封灯芯放在铜制柜台下面。',
  'I found a ledger page with tomorrow’s date. I left it where the clock shadow ends.': '我找到一页写着明日日期的账簿，把它留在钟影尽头。',
  'The eastern rain gutter works again, for now.': '东侧雨水槽暂时又能用了。',
  'The second-floor relay holds if nobody touches the red wire.': '只要没人碰那根红线，二楼的继电器就能继续工作。',
}

export function localizeTraceMessage(message: string, locale: Locale) {
  return locale === 'zh' ? demoTraceZh[message] || message : message
}

export function noticeKey(code: CommitCode | 'LOADED' | 'RESET' | 'REPORT_SAVED'): CopyKey | null {
  if (code === 'COMMITTED') return 'saved'
  if (code === 'DUPLICATE_ACTION') return 'duplicate'
  if (code === 'VERSION_CONFLICT') return 'versionConflict'
  if (code === 'ITEM_UNAVAILABLE') return 'unavailable'
  if (code === 'TRACE_EXPIRED') return 'expired'
  if (code === 'ALREADY_SUPPORTED') return 'alreadySupported'
  if (code === 'ALREADY_CONTRIBUTED') return 'alreadyContributed'
  if (code === 'AUTH_REQUIRED') return 'authRequired'
  if (code === 'RATE_LIMITED') return 'rateLimited'
  if (code === 'RESET') return 'resetDone'
  if (code === 'REPORT_SAVED') return 'reportSaved'
  if (code === 'LOADED') return null
  return 'genericError'
}
