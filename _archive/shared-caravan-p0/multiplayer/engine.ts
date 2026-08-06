import type {
  AbsencePolicy,
  EngineResult,
  IntentKind,
  MultiplayerArchive,
  PartyMember,
  RoundIntent,
  SharedWorldSnapshot,
  WorldEvent,
  WorldStats,
} from './types'
import { MultiplayerEngineError } from './types'

export const STORAGE_KEY = 'shared-caravan-lab-v1'
export const WORLD_ID = 'shared-caravan-local-p0'

export const MEMBERS: PartyMember[] = [
  { id: 'host', name: 'You', role: 'Pathfinder', initials: 'YU', absencePolicy: 'follow', isHost: true },
  { id: 'mira', name: 'Mira Vale', role: 'Scout', initials: 'MV', absencePolicy: 'follow' },
  { id: 'oren', name: 'Oren Pike', role: 'Keeper', initials: 'OP', absencePolicy: 'guard' },
  { id: 'sela', name: 'Sela Rowan', role: 'Mediator', initials: 'SR', absencePolicy: 'rest' },
]

const INITIAL_STATS: WorldStats = { vitality: 82, supplies: 7, renown: 0 }
const STAT_RANGES: Record<keyof WorldStats, [number, number]> = {
  vitality: [0, 100],
  supplies: [0, 12],
  renown: [-100, 100],
}

const clampStats = (stats: WorldStats): WorldStats => ({
  vitality: Math.min(STAT_RANGES.vitality[1], Math.max(STAT_RANGES.vitality[0], stats.vitality)),
  supplies: Math.min(STAT_RANGES.supplies[1], Math.max(STAT_RANGES.supplies[0], stats.supplies)),
  renown: Math.min(STAT_RANGES.renown[1], Math.max(STAT_RANGES.renown[0], stats.renown)),
})

export function createInitialSnapshot(): SharedWorldSnapshot {
  return {
    worldId: WORLD_ID,
    cartridgeId: 'the-wild-road',
    version: 1,
    round: 1,
    phase: 'collecting',
    location: '旧十字路口',
    time: '初夏第 1 天 · 08:10',
    objective: '在暴雨前抵达灯桥浅滩',
    stats: { ...INITIAL_STATS },
    intents: {},
    resolvedRounds: [],
    lastEventCursor: 0,
  }
}

export function createInitialArchive(): MultiplayerArchive {
  return {
    schemaVersion: 1,
    members: MEMBERS.map((member) => ({ ...member })),
    events: [],
    processedActionIds: [],
    snapshot: createInitialSnapshot(),
  }
}

function nextCursor(archive: MultiplayerArchive) {
  return archive.events.length ? archive.events[archive.events.length - 1].cursor + 1 : 1
}

function duplicateResult(archive: MultiplayerArchive): EngineResult {
  return { archive, status: 'duplicate' }
}

function assertAction(archive: MultiplayerArchive, actionId: string, expectedVersion: number, round: number) {
  if (archive.processedActionIds.includes(actionId)) return false
  if (round !== archive.snapshot.round) {
    throw new MultiplayerEngineError('ROUND_MISMATCH', `Round ${round} is stale; current round is ${archive.snapshot.round}.`, { round, currentRound: archive.snapshot.round })
  }
  if (expectedVersion !== archive.snapshot.version) {
    throw new MultiplayerEngineError('VERSION_CONFLICT', `Expected version ${expectedVersion}; current version is ${archive.snapshot.version}.`, { expectedVersion, currentVersion: archive.snapshot.version })
  }
  return true
}

function appendEvent(archive: MultiplayerArchive, event: WorldEvent, snapshot: SharedWorldSnapshot): MultiplayerArchive {
  return {
    ...archive,
    events: [...archive.events, event],
    processedActionIds: [...archive.processedActionIds, ...event.causedByActionIds.filter((id) => !archive.processedActionIds.includes(id))],
    snapshot: { ...snapshot, lastEventCursor: event.cursor },
  }
}

export function submitIntent(
  archive: MultiplayerArchive,
  input: Omit<RoundIntent, 'worldId' | 'submittedAt' | 'replacesIntentId'> & { submittedAt?: number },
): EngineResult {
  if (!assertAction(archive, input.id, input.expectedVersion, input.round)) return duplicateResult(archive)
  if (archive.snapshot.phase !== 'collecting') throw new MultiplayerEngineError('ROOM_NOT_COLLECTING', 'This round is no longer collecting intents.')
  if (!archive.members.some((member) => member.id === input.authorUserId)) throw new MultiplayerEngineError('MEMBER_UNKNOWN', `Unknown member ${input.authorUserId}.`)

  const previous = archive.snapshot.intents[input.authorUserId]
  const intent: RoundIntent = {
    ...input,
    worldId: WORLD_ID,
    submittedAt: input.submittedAt ?? Date.now(),
    ...(previous ? { replacesIntentId: previous.id } : {}),
  }
  const event: WorldEvent = {
    id: `event-${input.id}`,
    cursor: nextCursor(archive),
    worldId: WORLD_ID,
    version: archive.snapshot.version,
    round: archive.snapshot.round,
    type: previous ? 'intent_replaced' : 'intent_submitted',
    actorUserIds: [input.authorUserId],
    payload: { memberId: input.authorUserId, intent, ...(previous ? { previousIntentId: previous.id } : {}) },
    causedByActionIds: [input.id],
    createdAt: intent.submittedAt,
  }
  const snapshot: SharedWorldSnapshot = {
    ...archive.snapshot,
    intents: { ...archive.snapshot.intents, [input.authorUserId]: intent },
  }
  return { archive: appendEvent(archive, event, snapshot), status: 'committed', event }
}

function policyKind(policy: AbsencePolicy): IntentKind {
  if (policy === 'guard') return 'guard'
  if (policy === 'rest') return 'observe'
  return 'scout'
}

function makeDelegatedIntent(member: PartyMember, snapshot: SharedWorldSnapshot, now: number): RoundIntent {
  return {
    id: `delegated-${snapshot.round}-${member.id}`,
    worldId: WORLD_ID,
    round: snapshot.round,
    authorUserId: member.id,
    kind: policyKind(member.absencePolicy),
    action: `absence:${member.absencePolicy}`,
    submittedAt: now,
    expectedVersion: snapshot.version,
    delegatedByPolicy: member.absencePolicy,
  }
}

function resolveRules(snapshot: SharedWorldSnapshot, intents: RoundIntent[]) {
  let vitality = -2
  let supplies = -1
  let renown = 0
  const notes: string[] = ['base-travel-cost']
  const kinds = intents.map((intent) => intent.kind)
  const scouts = kinds.filter((kind) => kind === 'scout').length
  const foragers = kinds.filter((kind) => kind === 'forage').length
  const negotiators = kinds.filter((kind) => kind === 'negotiate').length
  const guards = kinds.filter((kind) => kind === 'guard').length

  vitality -= scouts * 6
  renown += scouts * 2
  if (scouts) notes.push('safe-route-found')

  vitality -= foragers * 3
  if (foragers) {
    supplies += 3 + Math.max(0, foragers - 1)
    notes.push(foragers > 1 ? 'forage-conflict' : 'forage-success')
  }

  supplies -= negotiators
  renown += negotiators * (scouts ? 6 : 3)
  if (negotiators) notes.push(scouts ? 'negotiation-supported' : 'negotiation-partial')

  vitality += guards * 4
  if (guards) notes.push('storm-guarded')
  else {
    supplies -= 2
    notes.push('storm-loss')
  }

  if (kinds.includes('observe')) notes.push('observation-kept')

  const deltas: WorldStats = { vitality, supplies, renown }
  const nextStats = clampStats({
    vitality: snapshot.stats.vitality + deltas.vitality,
    supplies: snapshot.stats.supplies + deltas.supplies,
    renown: snapshot.stats.renown + deltas.renown,
  })
  return { deltas, nextStats, notes }
}

export function resolveRound(
  archive: MultiplayerArchive,
  input: { actionId: string; expectedVersion: number; round: number; allowAbsence: boolean; createdAt?: number },
): EngineResult {
  if (!assertAction(archive, input.actionId, input.expectedVersion, input.round)) return duplicateResult(archive)
  if (archive.snapshot.resolvedRounds.includes(input.round) || archive.snapshot.phase === 'resolved') {
    throw new MultiplayerEngineError('ROUND_ALREADY_RESOLVED', `Round ${input.round} has already been resolved.`)
  }
  const missing = archive.members.filter((member) => !archive.snapshot.intents[member.id])
  if (missing.length && !input.allowAbsence) {
    throw new MultiplayerEngineError('MEMBERS_MISSING', `${missing.length} members have not submitted.`, { missingMemberIds: missing.map((member) => member.id) })
  }

  const now = input.createdAt ?? Date.now()
  const intents = archive.members.map((member) => archive.snapshot.intents[member.id] || makeDelegatedIntent(member, archive.snapshot, now))
  const { deltas, nextStats, notes } = resolveRules(archive.snapshot, intents)
  if (missing.length) notes.push('absence-policy-used')
  const nextVersion = archive.snapshot.version + 1
  const location = archive.snapshot.round === 1 ? '灯桥浅滩' : '雨后北岸'
  const time = archive.snapshot.round === 1 ? '初夏第 1 天 · 11:40' : `初夏第 1 天 · ${String(11 + archive.snapshot.round * 2).padStart(2, '0')}:40`
  const objective = archive.snapshot.round === 1 ? '沿浅滩北岸寻找今晚的共同营地' : '决定旅队下一段共同路线'
  const event: WorldEvent = {
    id: `resolution-${input.round}-${input.actionId}`,
    cursor: nextCursor(archive),
    worldId: WORLD_ID,
    version: nextVersion,
    round: input.round,
    type: 'round_resolved',
    actorUserIds: intents.map((intent) => intent.authorUserId),
    payload: {
      resolutionId: input.actionId,
      intents,
      deltas,
      nextStats,
      location,
      time,
      objective,
      notes,
      absentMemberIds: missing.map((member) => member.id),
      sourceActionIds: intents.map((intent) => intent.id),
    },
    causedByActionIds: [input.actionId],
    createdAt: now,
  }
  const snapshot: SharedWorldSnapshot = {
    ...archive.snapshot,
    version: nextVersion,
    phase: 'resolved',
    stats: nextStats,
    location,
    time,
    objective,
    resolvedRounds: [...archive.snapshot.resolvedRounds, input.round],
  }
  return { archive: appendEvent(archive, event, snapshot), status: 'committed', event }
}

export function startNextRound(
  archive: MultiplayerArchive,
  input: { actionId: string; expectedVersion: number; round: number; createdAt?: number },
): EngineResult {
  if (!assertAction(archive, input.actionId, input.expectedVersion, input.round)) return duplicateResult(archive)
  if (archive.snapshot.phase !== 'resolved') throw new MultiplayerEngineError('ROOM_NOT_COLLECTING', 'Resolve the current round before starting the next one.')
  const nextRound = archive.snapshot.round + 1
  const event: WorldEvent = {
    id: `round-${nextRound}-${input.actionId}`,
    cursor: nextCursor(archive),
    worldId: WORLD_ID,
    version: archive.snapshot.version,
    round: nextRound,
    type: 'round_started',
    actorUserIds: [],
    payload: { nextRound },
    causedByActionIds: [input.actionId],
    createdAt: input.createdAt ?? Date.now(),
  }
  const snapshot: SharedWorldSnapshot = { ...archive.snapshot, round: nextRound, phase: 'collecting', intents: {} }
  return { archive: appendEvent(archive, event, snapshot), status: 'committed', event }
}

export function updateAbsencePolicy(archive: MultiplayerArchive, memberId: string, policy: AbsencePolicy): MultiplayerArchive {
  if (!archive.members.some((member) => member.id === memberId)) throw new MultiplayerEngineError('MEMBER_UNKNOWN', `Unknown member ${memberId}.`)
  return { ...archive, members: archive.members.map((member) => member.id === memberId ? { ...member, absencePolicy: policy } : member) }
}

export function classifyCustomAction(action: string): IntentKind {
  const value = action.toLowerCase()
  if (/(scout|path|track|探路|侦察|路线|脚印)/.test(value)) return 'scout'
  if (/(forage|gather|food|wood|搜集|采集|食物|柴)/.test(value)) return 'forage'
  if (/(talk|trade|negotiate|ask|交涉|谈|交易|询问)/.test(value)) return 'negotiate'
  if (/(guard|watch|camp|守|警戒|营地)/.test(value)) return 'guard'
  return 'observe'
}

export function replaySnapshot(events: WorldEvent[]): SharedWorldSnapshot {
  return events.reduce((snapshot, event) => {
    if (event.type === 'intent_submitted' || event.type === 'intent_replaced') {
      const payload = event.payload as { memberId: string; intent: RoundIntent }
      return { ...snapshot, intents: { ...snapshot.intents, [payload.memberId]: payload.intent }, lastEventCursor: event.cursor }
    }
    if (event.type === 'round_resolved') {
      const payload = event.payload as {
        nextStats: WorldStats; location: string; time: string; objective: string
      }
      return {
        ...snapshot,
        version: event.version,
        phase: 'resolved',
        stats: clampStats(payload.nextStats),
        location: payload.location,
        time: payload.time,
        objective: payload.objective,
        resolvedRounds: snapshot.resolvedRounds.includes(event.round) ? snapshot.resolvedRounds : [...snapshot.resolvedRounds, event.round],
        lastEventCursor: event.cursor,
      }
    }
    const payload = event.payload as { nextRound: number }
    return { ...snapshot, round: payload.nextRound, phase: 'collecting', intents: {}, lastEventCursor: event.cursor }
  }, createInitialSnapshot())
}

export function rebuildArchive(input: unknown): MultiplayerArchive {
  if (!input || typeof input !== 'object') return createInitialArchive()
  const candidate = input as Partial<MultiplayerArchive>
  if (candidate.schemaVersion !== 1 || !Array.isArray(candidate.events) || !Array.isArray(candidate.members) || !candidate.snapshot) return createInitialArchive()
  const validEvents = candidate.events.filter((event) => event?.worldId === WORLD_ID && typeof event.cursor === 'number').sort((a, b) => a.cursor - b.cursor)
  const snapshot = replaySnapshot(validEvents)
  const processedActionIds = [...new Set(validEvents.flatMap((event) => event.causedByActionIds).filter((id) => typeof id === 'string'))]
  return {
    schemaVersion: 1,
    members: MEMBERS.map((base) => {
      const saved = candidate.members?.find((member) => member.id === base.id)
      return saved ? { ...base, absencePolicy: saved.absencePolicy } : { ...base }
    }),
    events: validEvents,
    processedActionIds,
    snapshot,
  }
}
