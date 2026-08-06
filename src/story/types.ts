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
export interface SkillDefinition { id: string; label: string; value: number }
export interface CharacterDefinition { id: string; name: string; role: string; vitality: number; stress: number; skills: SkillDefinition[]; detail?: string; lore?: string }
export interface Choice { id: string; label: string }
export type ImageBlockStatus = 'idle' | 'queued' | 'generating' | 'ready' | 'failed'
export const ITEM_IMAGE_STYLE_VERSION = 2
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
export interface RelationshipEvent { id: string; actor: string; axis: string; delta: number; source: string }

export interface StoryDirector {
  mode: 'guided' | 'open-world'
  fixedWorldRules: string[]
  generationRules: string[]
  choiceIntents: [string, string, string]
  maxActiveThreads: number
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
  imageDirector?: StoryImageDirector
  director?: StoryDirector
  statDefinitions: [StatDefinition, StatDefinition, StatDefinition]
  drawerLabels: Record<DrawerId, string>
  opening: { location: string; time: string; objective: string; imagePrompt: string; blocks: StoryBlock[]; choices: Choice[] }
  characters: CharacterDefinition[]
  initialMap: MapNode[]
  initialInventory: InventoryItem[]
  demoTurns: DemoTurn[]
}

export interface DemoTurn { match: string[]; content: string; imagePrompt?: string }

export interface StorySave {
  version: 4
  cartridgeId: CartridgeId
  locale: Locale
  remoteChatId?: string
  entered: boolean
  scene: number
  location: string
  time: string
  objective: string
  stats: Record<string, number>
  blocks: StoryBlock[]
  choices: Choice[]
  map: MapNode[]
  inventory: InventoryItem[]
  relationships: RelationshipEvent[]
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
  | { type: 'widget'; id: string; operation: 'value' | 'count' | 'add' | 'remove'; value: string | number }
  | { type: 'skill_check'; skill: string; dc: number; roll: number; modifier: number; total: number; result: string }
  | { type: 'state'; value: string }
  | { type: 'clock'; value: string }
  | { type: 'map_update'; location: string; connectedTo?: string; detail?: string; lore?: string; facts?: string[] }
  | { type: 'inventory'; action: 'add' | 'remove'; item: string; count: number; rarity?: 'common' | 'rare' | 'legendary'; detail?: string; effect?: string; lore?: string; metrics?: EntityMetric[]; imagePrompt?: string }
  | { type: 'reputation'; npc: string; action: string }
  | { type: 'party_change'; character: string; change: 'add' | 'remove' }
  | { type: 'session_end'; reason: string }

export interface ParsedScene { blocks: StoryBlock[]; commands: ParsedCommand[]; raw: string }

export interface AdapterContext {
  cartridge: StoryCartridge
  save: StorySave
  actionId: string
  locale: Locale
}

export interface AdapterProgress {
  label: string
  percent?: number
}

export interface AdapterResult {
  content: string
  imagePrompt?: string
}

export interface StoryAdapter {
  id: StoryMode
  send: (action: string, context: AdapterContext, onProgress?: (progress: AdapterProgress) => void) => Promise<AdapterResult>
}
