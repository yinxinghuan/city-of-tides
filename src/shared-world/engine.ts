import type {
  AidClaimedPayload,
  AnchorCommittedPayload,
  CommitResult,
  GrantReceipt,
  PermanentAnchor,
  ProjectContributionPayload,
  ProjectView,
  RegionId,
  RegionView,
  SeasonState,
  TraceCreatedPayload,
  TraceKind,
  TraceReinforcedPayload,
  TraceView,
  WorldAction,
  WorldArchive,
  WorldEvent,
  WorldView,
} from './types'
import { WorldRuleError } from './types'

export const HOUR = 60 * 60 * 1000
export const DAY = 24 * HOUR
export const SEASON_LENGTH = 7 * DAY
export const VISIBLE_TRACE_LIMIT = 6
export const PROJECT_TARGET = 100

export const REGIONS: RegionId[] = ['lighthouse', 'station', 'market', 'archive']

export const REGION_BASE: Record<RegionId, number> = {
  lighthouse: 42,
  station: 38,
  market: 46,
  archive: 35,
}

export const PROJECT_IDS: Record<RegionId, string> = {
  lighthouse: 'relight-the-beacon',
  station: 'raise-the-causeway',
  market: 'restore-the-rain-market',
  archive: 'seal-the-city-ledger',
}

export const TRACE_TTL: Record<TraceKind, number> = {
  message: 48 * HOUR,
  warning: 72 * HOUR,
  aid: 96 * HOUR,
  repair: 168 * HOUR,
  route: 168 * HOUR,
}

export const TRACE_EFFECT: Record<TraceKind, number> = {
  message: 0,
  warning: 0,
  aid: 8,
  repair: 12,
  route: 10,
}

const ANCHOR_TITLES: Record<RegionId, string> = {
  lighthouse: 'The Beacon That Remembered',
  station: 'The Raised Causeway',
  market: 'The Market Under Rain',
  archive: 'The Ledger Above the Tide',
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function seasonFor(now: number, sequence = 1): SeasonState {
  const startsAt = Math.floor(now / SEASON_LENGTH) * SEASON_LENGTH
  return { id: `tide-${Math.floor(startsAt / SEASON_LENGTH)}`, sequence, startsAt, endsAt: startsAt + SEASON_LENGTH }
}

export function createWorld(now = Date.now()): WorldArchive {
  return {
    schemaVersion: 1,
    worldId: 'city-of-tides-main',
    rulesetId: 'city-of-tides-v1',
    version: 1,
    cursor: 0,
    season: seasonFor(now),
    events: [],
    processedActionIds: [],
  }
}

function event<T>(archive: WorldArchive, action: WorldAction, type: WorldEvent['type'], payload: T, offset: number): WorldEvent<T> {
  return {
    id: crypto.randomUUID(),
    seq: archive.cursor + offset + 1,
    worldVersion: archive.version + 1,
    actionId: action.actionId,
    actorUserId: action.actorUserId,
    type,
    payload,
    seasonId: archive.season.id,
    createdAt: action.createdAt,
  }
}

function commitEvents(archive: WorldArchive, action: WorldAction, events: WorldEvent[]): CommitResult {
  const next: WorldArchive = {
    ...archive,
    version: archive.version + 1,
    cursor: archive.cursor + events.length,
    events: [...archive.events, ...events],
    processedActionIds: [...archive.processedActionIds, action.actionId].slice(-400),
  }
  return { accepted: true, duplicate: false, code: 'COMMITTED', archive: next, committedEvents: events }
}

function duplicate(archive: WorldArchive): CommitResult {
  return { accepted: true, duplicate: true, code: 'DUPLICATE_ACTION', archive, committedEvents: [] }
}

function validateAction(archive: WorldArchive, action: WorldAction) {
  if (archive.processedActionIds.includes(action.actionId)) return 'duplicate'
  if (action.expectedVersion !== archive.version) throw new WorldRuleError('VERSION_CONFLICT', `Expected v${action.expectedVersion}; current v${archive.version}`)
  if (!action.actorUserId || !action.actionId) throw new WorldRuleError('INVALID_ACTION', 'Missing identity or action id')
  return 'valid'
}

function traceStrength(trace: TraceCreatedPayload, createdAt: number, now: number, anchoredForSeason: boolean) {
  if (anchoredForSeason) return 1
  return clamp(1 - (now - createdAt) / Math.max(1, trace.expiresAt - createdAt), 0, 1)
}

function selectVisible(traces: TraceView[]) {
  const authorCounts = new Map<string, number>()
  const selected: TraceView[] = []
  for (const trace of traces.filter((item) => !item.expired).sort((a, b) => b.createdAt - a.createdAt)) {
    const count = authorCounts.get(trace.authorUserId) ?? 0
    if (count >= 2) continue
    selected.push(trace)
    authorCounts.set(trace.authorUserId, count + 1)
    if (selected.length === VISIBLE_TRACE_LIMIT) break
  }
  return selected
}

export function readWorld(archive: WorldArchive, now = Date.now()): WorldView {
  const created = new Map<string, { payload: TraceCreatedPayload; event: WorldEvent<TraceCreatedPayload> }>()
  const supports = new Map<string, Set<string>>()
  const claims = new Map<string, Set<string>>()
  const grants: GrantReceipt[] = []
  const projectContributions = new Map<string, Map<string, number>>()
  const anchors: PermanentAnchor[] = []

  for (const raw of archive.events) {
    if (raw.type === 'trace_created') {
      const evt = raw as WorldEvent<TraceCreatedPayload>
      created.set(evt.payload.traceId, { payload: evt.payload, event: evt })
    } else if (raw.type === 'trace_reinforced') {
      const payload = raw.payload as TraceReinforcedPayload
      if (!supports.has(payload.traceId)) supports.set(payload.traceId, new Set())
      supports.get(payload.traceId)!.add(payload.authorUserId)
    } else if (raw.type === 'aid_claimed') {
      const payload = raw.payload as AidClaimedPayload
      if (!claims.has(payload.traceId)) claims.set(payload.traceId, new Set())
      claims.get(payload.traceId)!.add(payload.authorUserId)
      grants.push({ id: payload.receiptId, userId: payload.authorUserId, traceId: payload.traceId, createdAt: raw.createdAt })
    } else if (raw.type === 'project_contributed') {
      const payload = raw.payload as ProjectContributionPayload
      if (raw.seasonId !== archive.season.id) continue
      if (!projectContributions.has(payload.projectId)) projectContributions.set(payload.projectId, new Map())
      projectContributions.get(payload.projectId)!.set(payload.authorUserId, payload.amount)
    } else if (raw.type === 'anchor_committed') {
      const payload = raw.payload as AnchorCommittedPayload
      anchors.push({
        id: payload.anchorId,
        regionId: payload.regionId,
        projectId: payload.projectId,
        title: payload.title,
        contributorUserIds: payload.contributorUserIds,
        createdAt: raw.createdAt,
        sourceEventId: raw.id,
      })
    }
  }

  const traces = Array.from(created.values()).map(({ payload, event: source }) => {
    const supportUserIds = Array.from(supports.get(payload.traceId) ?? [])
    const anchoredForSeason = supportUserIds.length >= 3 && source.seasonId === archive.season.id
    const strength = traceStrength(payload, source.createdAt, now, anchoredForSeason)
    const claimedByUserIds = Array.from(claims.get(payload.traceId) ?? [])
    const remainingCharges = payload.charges == null ? undefined : Math.max(0, payload.charges - claimedByUserIds.length)
    return {
      ...payload,
      sourceEventId: source.id,
      createdAt: source.createdAt,
      seasonId: source.seasonId,
      supportUserIds,
      supportCount: supportUserIds.length,
      anchoredForSeason,
      expired: strength <= 0 || source.seasonId !== archive.season.id,
      strength,
      remainingCharges,
      claimedByUserIds,
    } satisfies TraceView
  })

  const projects = Object.fromEntries(REGIONS.map((regionId) => {
    const id = PROJECT_IDS[regionId]
    const contributions = projectContributions.get(id) ?? new Map<string, number>()
    const progress = clamp(Array.from(contributions.values()).reduce((sum, value) => sum + value, 0), 0, PROJECT_TARGET)
    return [regionId, {
      id,
      regionId,
      progress,
      target: PROJECT_TARGET,
      contributorUserIds: Array.from(contributions.keys()),
      completed: progress >= PROJECT_TARGET,
    } satisfies ProjectView]
  })) as Record<RegionId, ProjectView>

  const regions = Object.fromEntries(REGIONS.map((regionId) => {
    const active = traces.filter((trace) => trace.regionId === regionId && !trace.expired)
    const traceDelta = active.reduce((sum, trace) => sum + TRACE_EFFECT[trace.kind] * trace.strength, 0)
    const anchorDelta = anchors.filter((anchor) => anchor.regionId === regionId).length * 6
    const value = Math.round(clamp(REGION_BASE[regionId] + traceDelta + anchorDelta, 0, 100))
    const status: RegionView['status'] = value < 20 ? 'submerged' : value < 45 ? 'fragile' : value < 85 ? 'recovering' : 'revived'
    return [regionId, {
      id: regionId,
      value,
      status,
      activeTraceCount: active.length,
      travellerCount: new Set(active.map((trace) => trace.authorUserId)).size,
    } satisfies RegionView]
  })) as Record<RegionId, RegionView>

  const visibleTracesByRegion = Object.fromEntries(REGIONS.map((regionId) => [regionId, selectVisible(traces.filter((trace) => trace.regionId === regionId))])) as Record<RegionId, TraceView[]>
  const activeTravellerIds = Array.from(new Set(traces.filter((trace) => !trace.expired).map((trace) => trace.authorUserId)))
  const dayProgress = ((now % DAY) + DAY) % DAY / DAY
  const tide = Math.round((dayProgress <= 0.5 ? dayProgress * 2 : (1 - dayProgress) * 2) * 100)

  return { version: archive.version, cursor: archive.cursor, season: archive.season, tide, regions, traces, visibleTracesByRegion, projects, anchors, grants, activeTravellerIds }
}

export function commitWorldAction(archive: WorldArchive, action: WorldAction): CommitResult {
  if (validateAction(archive, action) === 'duplicate') return duplicate(archive)
  const view = readWorld(archive, action.createdAt)

  if (action.type === 'create_trace') {
    const message = action.payload.message.trim().slice(0, 120)
    if (!REGIONS.includes(action.payload.regionId) || (!message && action.payload.kind === 'message')) throw new WorldRuleError('INVALID_ACTION', 'Invalid trace')
    if (action.payload.replyToId) {
      const target = view.traces.find((trace) => trace.traceId === action.payload.replyToId)
      if (!target) throw new WorldRuleError('ENTITY_NOT_FOUND', 'Reply target missing')
      if (target.expired) throw new WorldRuleError('TRACE_EXPIRED', 'Reply target expired')
    }
    const traceId = crypto.randomUUID()
    const payload: TraceCreatedPayload = {
      traceId,
      authorUserId: action.actorUserId,
      ...(action.actorName ? { authorName: action.actorName.slice(0, 40) } : {}),
      ...(action.actorAvatarUrl ? { authorAvatarUrl: action.actorAvatarUrl.slice(0, 500) } : {}),
      regionId: action.payload.regionId,
      kind: action.payload.kind,
      message,
      expiresAt: action.createdAt + TRACE_TTL[action.payload.kind],
      ...(action.payload.replyToId ? { replyToId: action.payload.replyToId } : {}),
      ...(action.payload.kind === 'aid' ? { charges: 3 } : {}),
    }
    return commitEvents(archive, action, [event(archive, action, 'trace_created', payload, 0)])
  }

  if (action.type === 'reinforce_trace') {
    const target = view.traces.find((trace) => trace.traceId === action.payload.traceId)
    if (!target) throw new WorldRuleError('ENTITY_NOT_FOUND', 'Trace missing')
    if (target.expired) throw new WorldRuleError('TRACE_EXPIRED', 'Trace expired')
    if (target.authorUserId === action.actorUserId || target.supportUserIds.includes(action.actorUserId)) throw new WorldRuleError('ALREADY_SUPPORTED', 'Already supported')
    const payload: TraceReinforcedPayload = { traceId: target.traceId, authorUserId: action.actorUserId }
    return commitEvents(archive, action, [event(archive, action, 'trace_reinforced', payload, 0)])
  }

  if (action.type === 'claim_aid') {
    const target = view.traces.find((trace) => trace.traceId === action.payload.traceId)
    if (!target) throw new WorldRuleError('ENTITY_NOT_FOUND', 'Aid missing')
    if (target.expired) throw new WorldRuleError('TRACE_EXPIRED', 'Aid expired')
    if (target.kind !== 'aid' || (target.remainingCharges ?? 0) <= 0 || target.claimedByUserIds.includes(action.actorUserId)) throw new WorldRuleError('ITEM_UNAVAILABLE', 'Aid unavailable')
    const payload: AidClaimedPayload = { traceId: target.traceId, authorUserId: action.actorUserId, receiptId: crypto.randomUUID() }
    return commitEvents(archive, action, [event(archive, action, 'aid_claimed', payload, 0)])
  }

  if (action.type === 'contribute_project') {
    if (!REGIONS.includes(action.payload.regionId) || action.payload.amount <= 0 || action.payload.amount > 25) throw new WorldRuleError('INVALID_ACTION', 'Invalid contribution')
    const project = view.projects[action.payload.regionId]
    if (project.contributorUserIds.includes(action.actorUserId)) throw new WorldRuleError('ALREADY_CONTRIBUTED', 'Already contributed')
    const payload: ProjectContributionPayload = {
      projectId: project.id,
      authorUserId: action.actorUserId,
      amount: action.payload.amount,
      message: action.payload.message.trim().slice(0, 120),
    }
    return commitEvents(archive, action, [event(archive, action, 'project_contributed', payload, 0)])
  }

  if (action.type === 'resolve_season') {
    if (!action.payload.force && action.createdAt < archive.season.endsAt) throw new WorldRuleError('SEASON_OPEN', 'Season is still open')
    const events: WorldEvent[] = []
    for (const regionId of REGIONS) {
      const project = view.projects[regionId]
      if (!project.completed || project.contributorUserIds.length < 3) continue
      const alreadyAnchored = view.anchors.some((anchor) => anchor.projectId === project.id)
      if (alreadyAnchored) continue
      const payload: AnchorCommittedPayload = {
        anchorId: crypto.randomUUID(),
        regionId,
        projectId: project.id,
        contributorUserIds: project.contributorUserIds,
        title: ANCHOR_TITLES[regionId],
      }
      events.push(event(archive, action, 'anchor_committed', payload, events.length))
    }
    events.push(event(archive, action, 'season_resolved', { seasonId: archive.season.id }, events.length))
    const result = commitEvents(archive, action, events)
    const nextStartsAt = action.payload.force ? action.createdAt : archive.season.endsAt
    result.archive = {
      ...result.archive,
      season: {
        id: `tide-${Math.floor(nextStartsAt / SEASON_LENGTH)}-${archive.season.sequence + 1}`,
        sequence: archive.season.sequence + 1,
        startsAt: nextStartsAt,
        endsAt: nextStartsAt + SEASON_LENGTH,
      },
    }
    return result
  }

  throw new WorldRuleError('INVALID_ACTION', 'Unknown action')
}

export function rebuildArchive(candidate: unknown): WorldArchive {
  const value = candidate as Partial<WorldArchive> | null
  if (!value || value.schemaVersion !== 1 || !Array.isArray(value.events)) return createWorld()
  const events = value.events
    .filter((item): item is WorldEvent => Boolean(item && typeof item.id === 'string' && typeof item.seq === 'number' && typeof item.actionId === 'string'))
    .sort((a, b) => a.seq - b.seq)
  return {
    schemaVersion: 1,
    worldId: typeof value.worldId === 'string' ? value.worldId : 'city-of-tides-main',
    rulesetId: 'city-of-tides-v1',
    version: Math.max(1, ...events.map((item) => item.worldVersion)),
    cursor: Math.max(0, ...events.map((item) => item.seq)),
    season: value.season && typeof value.season.id === 'string' ? value.season : seasonFor(Date.now()),
    events,
    processedActionIds: Array.from(new Set(events.map((item) => item.actionId))).slice(-400),
  }
}
