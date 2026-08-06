import { useMemo, useState } from 'react'
import type { IntentKind, Locale } from './types'

const copy = {
  zh: {
    lab: '多人世界 · 内部实验', title: '共同旅队', subtitle: '四个人，一段共同生效的旅程',
    round: '回合', version: '版本', world: '共享世界', objective: '共同目标', eventLog: '共同事件',
    collecting: '收集行动', resolved: '本轮已结算', ready: '已提交', waiting: '等待', submitted: '已提交 {n}/4',
    activeAs: '现在由谁行动', switchHint: '切换测试身份，为每位成员提交一项行动。',
    absencePolicy: '缺席策略', follow: '跟随探路', guardPolicy: '留守营地', rest: '休息观察',
    chooseAction: '选择本轮行动', scout: '探路', forage: '搜集', negotiate: '交涉', guard: '守营', observe: '观察',
    scoutCost: '体力 −6 · 名望 +2', forageCost: '体力 −3 · 补给 +3/递减', negotiateCost: '补给 −1 · 名望 +3–6', guardCost: '体力 +4 · 防暴雨损耗',
    customPlaceholder: '也可以写下任何行动，例如“沿河找一条更安全的路”', send: '提交自由行动',
    replace: '将替换上一项行动', resolve: '结算本轮', resolveMissing: '按缺席策略结算', nextRound: '进入下一轮',
    allReady: '四人的行动已汇齐，可以统一结算。', missing: '仍有 {n} 人没有提交。',
    confirmAbsence: '确认代行缺席成员？', confirmAbsenceBody: '系统会按每个人预设的缺席策略生成本轮行动，并在结果里明确标注。', cancel: '取消', confirm: '确认结算',
    experiment: '实验控制', stale: '模拟旧版本提交', duplicate: '重放当前 actionId', duplicateIgnored: '重复 actionId 已忽略，没有新增事件。',
    sync: '同步到当前版本', reset: '重置实验', resetQuestion: '清除所有本地多人事件并回到第 1 轮？', resetConfirm: '确认重置',
    noEvents: '还没有人提交。第一项行动会在这里留下署名记录。',
    result: '共同结果', deltas: '共享数值变化', delegated: '系统按缺席策略代行',
    errorVersion: '版本冲突：这项行动基于 v{expected}，当前世界已是 v{current}。',
    errorMissing: '还有成员未提交；请等待，或使用缺席策略结算。', errorResolved: '本轮已经结算，没有再次写入。', errorGeneric: '这项操作没有写入共同世界。',
    toastCommitted: '行动已进入本轮账页。', toastReplaced: '旧行动已被新的意图替换。', toastResolved: '共同世界已推进到 v{n}。', toastNext: '第 {n} 轮已经开始。',
    noteBase: '旅队承担了基础路程消耗。', noteSafe: '探路者确认了可共同通过的安全方向。', noteForage: '搜集者补充了干燥物资。',
    noteForageConflict: '多人争用同一处物资，后续收益递减。', noteNegotiation: '探路证据支持了交涉，谈判获得完整进展。', noteNegotiationPartial: '没有探路证据，交涉只取得部分信任。',
    noteGuarded: '守营者挡住暴雨，避免了额外补给损失。', noteStorm: '无人守营，暴雨带走了两份补给。', noteObserve: '观察行动保留了线索，但没有直接改变数值。', noteAbsence: '本轮使用了成员预设的缺席策略。',
    ruleSummary: '每人一项行动。规则先结算共同事实，叙事随后解释；重复与旧版本写入不会改变世界。',
    muted: '开启声音', sound: '静音', language: '切换语言', host: '主持人', simulated: '模拟成员', current: '当前',
  },
  en: {
    lab: 'MULTIPLAYER WORLD · INTERNAL LAB', title: 'Shared Caravan', subtitle: 'Four people, one journey that commits once',
    round: 'Round', version: 'Version', world: 'Shared world', objective: 'Shared objective', eventLog: 'Common ledger',
    collecting: 'Collecting intents', resolved: 'Round resolved', ready: 'Submitted', waiting: 'Waiting', submitted: '{n}/4 submitted',
    activeAs: 'Acting as', switchHint: 'Switch test identities and submit one intent for each member.',
    absencePolicy: 'Absence policy', follow: 'Follow and scout', guardPolicy: 'Guard camp', rest: 'Rest and observe',
    chooseAction: 'Choose this round’s action', scout: 'Scout ahead', forage: 'Forage', negotiate: 'Negotiate', guard: 'Guard camp', observe: 'Observe',
    scoutCost: 'Vitality −6 · Renown +2', forageCost: 'Vitality −3 · Supplies +3/diminishing', negotiateCost: 'Supplies −1 · Renown +3–6', guardCost: 'Vitality +4 · Stops storm loss',
    customPlaceholder: 'Or write any action, such as “follow the river for a safer route”', send: 'Submit free action',
    replace: 'This replaces the previous intent', resolve: 'Resolve round', resolveMissing: 'Resolve with absence policies', nextRound: 'Start next round',
    allReady: 'All four intents have converged. The round can resolve.', missing: '{n} members have not submitted.',
    confirmAbsence: 'Delegate absent members?', confirmAbsenceBody: 'The system will use each member’s chosen absence policy and mark every delegated action in the result.', cancel: 'Cancel', confirm: 'Confirm resolution',
    experiment: 'Lab controls', stale: 'Simulate stale version', duplicate: 'Replay current actionId', duplicateIgnored: 'Duplicate actionId ignored. No event was added.',
    sync: 'Sync current version', reset: 'Reset lab', resetQuestion: 'Clear every local multiplayer event and return to round 1?', resetConfirm: 'Reset everything',
    noEvents: 'No one has submitted yet. The first intent will leave an attributed record here.',
    result: 'Shared result', deltas: 'Shared stat changes', delegated: 'Delegated by absence policy',
    errorVersion: 'Version conflict: this intent expected v{expected}; the shared world is v{current}.',
    errorMissing: 'Members are still missing. Wait, or resolve with absence policies.', errorResolved: 'This round already resolved; nothing was written twice.', errorGeneric: 'The operation was not written into the shared world.',
    toastCommitted: 'Intent entered this round’s ledger.', toastReplaced: 'The previous intent was replaced.', toastResolved: 'The shared world advanced to v{n}.', toastNext: 'Round {n} has started.',
    noteBase: 'The caravan paid the ordinary cost of travel.', noteSafe: 'Scouts confirmed a route the whole party can use.', noteForage: 'Foragers added dry provisions.',
    noteForageConflict: 'Several people reached for the same supplies, so later gains diminished.', noteNegotiation: 'Scouting evidence supported a full negotiation.', noteNegotiationPartial: 'Without scouting evidence, negotiation earned only partial trust.',
    noteGuarded: 'A guard held the camp through the storm and prevented extra loss.', noteStorm: 'No one guarded camp; the storm took two supplies.', noteObserve: 'Observation preserved a clue without changing a shared stat.', noteAbsence: 'This round used preset absence policies.',
    ruleSummary: 'One intent per person. Rules commit shared facts before narration; duplicates and stale versions cannot change the world.',
    muted: 'Turn sound on', sound: 'Mute sound', language: 'Switch language', host: 'Host', simulated: 'Simulated member', current: 'Current',
  },
} as const

export type CopyKey = keyof typeof copy.zh

function detectLocale(): Locale {
  const query = new URLSearchParams(window.location.search).get('lang')
  if (query === 'zh' || query === 'en') return query
  const saved = localStorage.getItem('shared_caravan_locale')
  if (saved === 'zh' || saved === 'en') return saved
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export function useLabI18n() {
  const [locale, setLocaleState] = useState<Locale>(detectLocale)
  const setLocale = (next: Locale) => { localStorage.setItem('shared_caravan_locale', next); setLocaleState(next) }
  const t = useMemo(() => (key: CopyKey, vars?: Record<string, string | number>) => {
    let value: string = copy[locale][key]
    for (const [name, replacement] of Object.entries(vars || {})) value = value.replace(`{${name}}`, String(replacement))
    return value
  }, [locale])
  return { locale, setLocale, t }
}

export const intentCopyKey: Record<IntentKind, CopyKey> = {
  scout: 'scout', forage: 'forage', negotiate: 'negotiate', guard: 'guard', observe: 'observe',
}

export const noteCopyKey: Record<string, CopyKey> = {
  'base-travel-cost': 'noteBase', 'safe-route-found': 'noteSafe', 'forage-success': 'noteForage',
  'forage-conflict': 'noteForageConflict', 'negotiation-supported': 'noteNegotiation', 'negotiation-partial': 'noteNegotiationPartial',
  'storm-guarded': 'noteGuarded', 'storm-loss': 'noteStorm', 'observation-kept': 'noteObserve', 'absence-policy-used': 'noteAbsence',
}
