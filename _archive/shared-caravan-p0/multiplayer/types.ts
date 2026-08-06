export type RoomPhase = 'collecting' | 'resolved'
export type AbsencePolicy = 'follow' | 'guard' | 'rest'
export type IntentKind = 'scout' | 'forage' | 'negotiate' | 'guard' | 'observe'
export type Locale = 'zh' | 'en'

export interface PartyMember {
  id: string
  name: string
  role: string
  initials: string
  absencePolicy: AbsencePolicy
  isHost?: boolean
}

export interface RoundIntent {
  id: string
  worldId: string
  round: number
  authorUserId: string
  kind: IntentKind
  action: string
  submittedAt: number
  expectedVersion: number
  replacesIntentId?: string
  delegatedByPolicy?: AbsencePolicy
}

export interface WorldStats {
  vitality: number
  supplies: number
  renown: number
}

export interface SharedWorldSnapshot {
  worldId: string
  cartridgeId: string
  version: number
  round: number
  phase: RoomPhase
  location: string
  time: string
  objective: string
  stats: WorldStats
  intents: Record<string, RoundIntent>
  resolvedRounds: number[]
  lastEventCursor: number
}

export type EventPayload =
  | { memberId: string; intent: RoundIntent; previousIntentId?: string }
  | {
      resolutionId: string
      intents: RoundIntent[]
      deltas: WorldStats
      nextStats: WorldStats
      location: string
      time: string
      objective: string
      notes: string[]
      absentMemberIds: string[]
      sourceActionIds: string[]
    }
  | { nextRound: number }

export interface WorldEvent {
  id: string
  cursor: number
  worldId: string
  version: number
  round: number
  type: 'intent_submitted' | 'intent_replaced' | 'round_resolved' | 'round_started'
  actorUserIds: string[]
  payload: EventPayload
  causedByActionIds: string[]
  createdAt: number
}

export interface MultiplayerArchive {
  schemaVersion: 1
  members: PartyMember[]
  events: WorldEvent[]
  processedActionIds: string[]
  snapshot: SharedWorldSnapshot
}

export interface EngineResult {
  archive: MultiplayerArchive
  status: 'committed' | 'duplicate'
  event?: WorldEvent
}

export type EngineErrorCode = 'VERSION_CONFLICT' | 'ROUND_MISMATCH' | 'MEMBER_UNKNOWN' | 'ROOM_NOT_COLLECTING' | 'MEMBERS_MISSING' | 'ROUND_ALREADY_RESOLVED'

export class MultiplayerEngineError extends Error {
  code: EngineErrorCode
  details?: Record<string, unknown>

  constructor(code: EngineErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'MultiplayerEngineError'
    this.code = code
    this.details = details
  }
}
