export type Locale = 'zh' | 'en'

export type RegionId = 'lighthouse' | 'station' | 'market' | 'archive'

export type TraceKind = 'message' | 'warning' | 'aid' | 'repair' | 'route'

export interface Traveller {
  id: string
  name: string
  initials: string
  avatarUrl?: string
}

export interface SeasonState {
  id: string
  sequence: number
  startsAt: number
  endsAt: number
}

export interface TraceCreatedPayload {
  traceId: string
  authorUserId: string
  authorName?: string
  authorAvatarUrl?: string
  regionId: RegionId
  kind: TraceKind
  message: string
  expiresAt: number
  replyToId?: string
  charges?: number
}

export interface TraceReinforcedPayload {
  traceId: string
  authorUserId: string
}

export interface AidClaimedPayload {
  traceId: string
  authorUserId: string
  receiptId: string
}

export interface ProjectContributionPayload {
  projectId: string
  authorUserId: string
  amount: number
  message: string
}

export interface AnchorCommittedPayload {
  anchorId: string
  regionId: RegionId
  projectId: string
  contributorUserIds: string[]
  title: string
}

export type WorldEventType =
  | 'trace_created'
  | 'trace_reinforced'
  | 'aid_claimed'
  | 'project_contributed'
  | 'anchor_committed'
  | 'season_resolved'

export interface WorldEvent<T = unknown> {
  id: string
  seq: number
  worldVersion: number
  actionId: string
  actorUserId: string
  type: WorldEventType
  payload: T
  seasonId: string
  createdAt: number
}

export interface PermanentAnchor {
  id: string
  regionId: RegionId
  projectId: string
  title: string
  contributorUserIds: string[]
  createdAt: number
  sourceEventId: string
}

export interface WorldArchive {
  schemaVersion: 1
  worldId: string
  rulesetId: 'city-of-tides-v1'
  version: number
  cursor: number
  season: SeasonState
  events: WorldEvent[]
  processedActionIds: string[]
}

export interface TraceView extends TraceCreatedPayload {
  sourceEventId: string
  createdAt: number
  seasonId: string
  supportUserIds: string[]
  supportCount: number
  anchoredForSeason: boolean
  expired: boolean
  strength: number
  remainingCharges?: number
  claimedByUserIds: string[]
}

export interface RegionView {
  id: RegionId
  value: number
  status: 'submerged' | 'fragile' | 'recovering' | 'revived'
  activeTraceCount: number
  travellerCount: number
}

export interface ProjectView {
  id: string
  regionId: RegionId
  progress: number
  target: number
  contributorUserIds: string[]
  completed: boolean
}

export interface GrantReceipt {
  id: string
  userId: string
  traceId: string
  createdAt: number
}

export interface SharedGrant {
  kind: string
  quantity: number
}

export interface PendingGrantReceipt {
  receiptId: string
  sourceEntityId: string
  grant: SharedGrant
  createdAt: number
}

export interface PlayerInventoryItem {
  kind: string
  quantity: number
  receiptIds: string[]
  lastReceivedAt: number
}

export interface CityPlayerSave {
  schemaVersion: 1
  inventory: PlayerInventoryItem[]
  appliedGrantReceiptIds: string[]
  _lastActive?: number
}

export interface WorldView {
  version: number
  cursor: number
  season: SeasonState
  tide: number
  regions: Record<RegionId, RegionView>
  traces: TraceView[]
  visibleTracesByRegion: Record<RegionId, TraceView[]>
  projects: Record<RegionId, ProjectView>
  anchors: PermanentAnchor[]
  grants: GrantReceipt[]
  activeTravellerIds: string[]
}

export interface BaseAction {
  actionId: string
  actorUserId: string
  actorName?: string
  actorAvatarUrl?: string
  expectedVersion: number
  createdAt: number
}

export type WorldAction =
  | (BaseAction & {
      type: 'create_trace'
      payload: { regionId: RegionId; kind: TraceKind; message: string; replyToId?: string }
    })
  | (BaseAction & { type: 'reinforce_trace'; payload: { traceId: string } })
  | (BaseAction & { type: 'claim_aid'; payload: { traceId: string } })
  | (BaseAction & {
      type: 'contribute_project'
      payload: { regionId: RegionId; amount: number; message: string }
    })
  | (BaseAction & { type: 'resolve_season'; payload: { force?: boolean } })

export type CommitCode =
  | 'COMMITTED'
  | 'DUPLICATE_ACTION'
  | 'VERSION_CONFLICT'
  | 'INVALID_ACTION'
  | 'TRACE_EXPIRED'
  | 'ENTITY_NOT_FOUND'
  | 'ITEM_UNAVAILABLE'
  | 'ALREADY_SUPPORTED'
  | 'ALREADY_CONTRIBUTED'
  | 'SEASON_OPEN'
  | 'AUTH_REQUIRED'
  | 'RATE_LIMITED'
  | 'RULESET_MISMATCH'
  | 'CONTENT_REJECTED'

export interface CommitResult {
  accepted: boolean
  duplicate: boolean
  code: CommitCode
  archive: WorldArchive
  committedEvents: WorldEvent[]
}

export class WorldRuleError extends Error {
  constructor(public code: Exclude<CommitCode, 'COMMITTED' | 'DUPLICATE_ACTION'>, message: string) {
    super(message)
    this.name = 'WorldRuleError'
  }
}
