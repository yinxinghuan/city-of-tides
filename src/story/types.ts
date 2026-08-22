export type CartridgeId = string
export type DrawerId = 'party' | 'map' | 'inventory' | 'log'
export type StoryMode = 'demo' | 'aigram' | 'remote'
export type Locale = 'zh' | 'en'

export interface ThemeTokens {
  outer: string; surface: string; paper: string; ink: string; muted: string; accent: string; danger: string; gold: string
  material: 'harbor' | 'apartment' | 'wayfarer'
}

export interface StoryAudioTheme {
  material: 'harbor' | 'apartment' | 'wayfarer'
  bpm: number
  rootHz: number
  scale: number[]
  levels: { music: number; ambient: number; sfx: number; master: number }
  tension: Array<{ statId: string; direction: 'high' | 'low'; weight: number }>
  recorded?: StoryRecordedAudio
}

export type StoryAudioCueName =
  | 'open' | 'action' | 'success' | 'failure' | 'change' | 'discovery' | 'treasure' | 'image' | 'summary' | 'error'
  | 'coinGain' | 'coinSpend' | 'energy' | 'standing' | 'relationship' | 'travel' | 'item'

export interface StoryRecordedTrack { src: string; gain: number; role?: 'effect' | 'feature'; cooldownMs?: number }
export interface StoryRecordedAudio {
  music?: StoryRecordedTrack
  ambience?: StoryRecordedTrack
  ambienceByLocationId?: Record<string, StoryRecordedTrack>
  cues?: Partial<Record<StoryAudioCueName, StoryRecordedTrack>>
}

export interface StatDefinition {
  id: string
  label: string
  min: number
  max: number
  initial: number
  inverse?: boolean
  display?: 'bar' | 'number'
  warningAt?: number
  dangerAt?: number
  maxDelta?: number
}
export type StoryFactValue = string | number | boolean
export interface SkillDefinition { id: string; label: string; value: number }
export type CharacterStatus = 'known' | 'companion' | 'departed'
export interface CharacterDefinition { id: string; name: string; role: string; vitality: number; stress: number; skills: SkillDefinition[]; detail?: string; lore?: string; initialStatus?: CharacterStatus; hiddenUntilIntroduced?: boolean }
export interface StoryCharacter extends CharacterDefinition {
  status: CharacterStatus
  origin: 'cartridge' | 'generated'
  lastKnownLocation?: string
  updatedAtScene: number
  joinedAtScene?: number
  leftAtScene?: number
}
export interface Choice { id: string; label: string }
export type ImageBlockStatus = 'idle' | 'queued' | 'generating' | 'ready' | 'failed'
export const ITEM_IMAGE_STYLE_VERSION = 2
export const SCENE_IMAGE_PROMPT_VERSION = 5
export type SceneImageSubject = 'player' | 'environment' | 'others'
export type SceneImagePerspective = 'first-person' | 'observer'
export interface StoryBlock { id: string; kind: 'narration' | 'dialogue' | 'check' | 'change' | 'event' | 'summary' | 'image'; text: string; speaker?: string; tone?: string; data?: Record<string, string | number> }
export interface EntityMetric { label: string; value: string }
export interface MapNode { id: string; label: string; connectedTo?: string; current?: boolean; visited?: boolean; detail?: string; lore?: string; facts?: string[] }
export interface InventoryItem {
  id: string
  label: string
  count: number
  rarity?: 'common' | 'rare' | 'legendary'
  detail?: string
  effect?: string
  lore?: string
  metrics?: EntityMetric[]
  imagePrompt?: string
  imageStatus?: ImageBlockStatus
  imageUrl?: string
  imageStyleVersion?: number
}
export interface RelationshipEvent { id: string; actor: string; characterId?: string; axis: string; delta: number; source: string }

export interface StoryDirector {
  mode: 'guided' | 'open-world'
  fixedWorldRules: string[]
  generationRules: string[]
  choiceIntents: [string, string, string]
  maxActiveThreads: number
}

export type DangerPhase = 'calm' | 'warning' | 'confrontation'
export type DangerOutcome = 'none' | 'critical-success' | 'success' | 'costly-success' | 'failure' | 'critical-failure'

export interface DangerCost {
  statId: string
  operation: 'add' | 'remove'
  amount: number
}

export interface StoryDangerDirector {
  minSafeTurns: number
  maxSafeTurns: number
  cooldownTurns: number
  escalationStats: string[]
  threatPalette: string[]
  methods: [string, string, string]
  legacyMethods?: [string, string, string][]
  physicalCombat: 'none' | 'rare' | 'occasional'
  resolution: {
    skill: string
    modifier: number
    dcBySeverity: [number, number, number, number, number]
    criticalDcBonus?: number
    fallbackCosts: [DangerCost, ...DangerCost[]]
  }
}

export interface StoryDangerState {
  phase: DangerPhase
  safeTurns: number
  cycle: number
  cooldownTurns: number
  severity: number
  currentThreat?: string
  lastOutcome: DangerOutcome
  lastResolvedScene?: number
}

export interface DangerCheck {
  skill: string
  dc: number
  roll: number
  modifier: number
  total: number
  outcome: Exclude<DangerOutcome, 'none'>
}

export interface DangerDirective {
  phase: 'warning' | 'confrontation' | 'resolution'
  severity: number
  threat: string
  methods: [string, string, string]
  physicalCombat: StoryDangerDirector['physicalCombat']
  check?: DangerCheck
}

export type SceneImageTrigger =
  | 'new-location'
  | 'rare-item'
  | 'party-change'
  | 'chapter-checkpoint'
  | 'relationship-change'
  | 'objective-change'
  | 'skill-outcome'

export interface StoryImageDirector {
  maxQuietTurns: number
  softCooldownTurns: number
  guaranteedTriggers: SceneImageTrigger[]
  softTriggers: SceneImageTrigger[]
  perspective?: {
    ordinary: 'observer' | 'balanced' | 'first-person-preferred'
    importantDialogue: SceneImagePerspective
    newLocation: SceneImagePerspective
  }
}

export type DomainEffect =
  | { type: 'fact'; key: string; value: StoryFactValue }
  | { type: 'stat'; id: string; delta: number }
  | { type: 'map'; location: string }
  | { type: 'clock'; value: string }
  | { type: 'objective'; value: string }
  | { type: 'character'; id: string; status?: CharacterStatus }

export interface DomainRule {
  id: string
  when: { factEquals?: Record<string, StoryFactValue>; factUnset?: string[] }
  action: { exact?: string[]; includes?: string[] }
  effects: DomainEffect[]
  successText: string
  successChoices: [string, string, string]
  rejectionText?: string
  rejectionChoices?: [string, string, string]
}

export interface DomainActionResolution {
  kind: 'accepted' | 'rejected'
  ruleId: string
  text: string
  effects: DomainEffect[]
  choices: [string, string, string]
}

export interface StoryCartridge {
  schemaVersion: 1
  id: CartridgeId
  locale: Locale
  coverImage: string
  entryImage?: string
  copy: {
    title: string; subtitle: string; promise: string; enter: string; continue: string; customAction: string
    itemImagingTitle: string; itemImagingBody: string
  }
  theme: ThemeTokens
  audioTheme: StoryAudioTheme
  itemImageDirection?: string
  sceneImageDirection?: string
  sceneImageAvoid?: string
  transitionAnchor?: string
  imageDirector?: StoryImageDirector
  director?: StoryDirector
  dangerDirector?: StoryDangerDirector
  domainRules?: DomainRule[]
  initialFacts?: Record<string, StoryFactValue>
  statDefinitions: [StatDefinition, StatDefinition, StatDefinition]
  drawerLabels: Record<DrawerId, string>
  opening: { location: string; time: string; objective: string; imagePrompt: string; blocks: StoryBlock[]; choices: Choice[] }
  characters: CharacterDefinition[]
  initialPartyMemberIds?: string[]
  initialMap: MapNode[]
  initialInventory: InventoryItem[]
  demoTurns: DemoTurn[]
}

export interface DemoTurn { match: string[]; content: string; imagePrompt?: string; imageSubject?: SceneImageSubject }

export interface StorySave {
  version: 9
  cartridgeId: CartridgeId
  locale: Locale
  remoteChatId?: string
  entered: boolean
  scene: number
  location: string
  time: string
  objective: string
  decisionContext: string
  stats: Record<string, number>
  facts: Record<string, StoryFactValue>
  blocks: StoryBlock[]
  choices: Choice[]
  map: MapNode[]
  inventory: InventoryItem[]
  characters: StoryCharacter[]
  partyMemberIds: string[]
  relationships: RelationshipEvent[]
  danger: StoryDangerState
  sessionEnded: boolean
  lastActionId?: string
  _lastActive?: number
}

export interface StoryArchive {
  version: 1
  worlds: Record<CartridgeId, StorySave>
  _lastActive?: number
}

export type ParsedCommand =
  | { type: 'choices'; choices: string[] }
  | { type: 'situation'; text: string }
  | { type: 'widget'; id: string; operation: 'value' | 'count' | 'add' | 'remove'; value: string | number }
  | { type: 'skill_check'; skill: string; dc: number; roll: number; modifier: number; total: number; result: string }
  | { type: 'state'; value: string }
  | { type: 'clock'; value: string }
  | { type: 'fact'; key: string; value: StoryFactValue }
  | { type: 'map_update'; location: string; connectedTo?: string; detail?: string; lore?: string; facts?: string[] }
  | { type: 'inventory'; action: 'add' | 'remove'; item: string; count: number; rarity?: 'common' | 'rare' | 'legendary'; detail?: string; effect?: string; lore?: string; metrics?: EntityMetric[]; imagePrompt?: string }
  | { type: 'reputation'; npc: string; action: string }
  | { type: 'character_update'; characterId?: string; character: string; role?: string; detail?: string; lore?: string; vitality?: number; stress?: number; skills?: SkillDefinition[] }
  | { type: 'party_change'; characterId?: string; character: string; change: 'add' | 'remove'; role?: string; detail?: string; lore?: string; vitality?: number; stress?: number; skills?: SkillDefinition[] }
  | { type: 'encounter'; phase: 'warning' | 'confrontation' | 'resolution'; kind?: string; severity?: number; outcome?: DangerOutcome }
  | { type: 'session_end'; reason: string }

export interface ParsedScene { blocks: StoryBlock[]; commands: ParsedCommand[]; raw: string }

export interface AdapterContext {
  cartridge: StoryCartridge
  save: StorySave
  actionId: string
  locale: Locale
  dangerDirective?: DangerDirective
}

export interface AdapterProgress {
  label: string
  percent?: number
}

export interface AdapterResult {
  content: string
  imagePrompt?: string
  imageSubject?: SceneImageSubject
}

export interface StoryAdapter {
  id: StoryMode
  send: (action: string, context: AdapterContext, onProgress?: (progress: AdapterProgress) => void) => Promise<AdapterResult>
}
