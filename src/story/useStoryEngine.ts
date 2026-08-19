import { useCallback, useEffect, useRef, useState } from 'react'
import { useGenImage } from '../shared/runtime/useGenImage'
import { useGameSave } from '../shared/save/useGameSave'
import { aigramAdapter } from './adapters/aigram'
import { mockAdapter } from './adapters/mock'
import { remoteAdapter } from './adapters/remote'
import { resolveCartridge } from './cartridges'
import { applyParsedScene, createImageBlock, createInitialSave, createRecoveryChoices, localizeKnownState, normalizeCharacterState, updateImageBlock, updateInventoryItemImage } from './engine/reducer'
import { parseStoryProtocol } from './engine/protocol'
import { shouldUsePlayerImageReference, upgradePendingSceneImagePrompts } from './engine/imageDirector'
import { buildDangerDirective, normalizeDangerState } from './engine/dangerDirector'
import { resolveDomainAction } from './engine/domainRules'
import { recordAuthorityShadowSample } from './engine/authorityShadow'
import { t } from './i18n'
import { ITEM_IMAGE_STYLE_VERSION, type AdapterProgress, type InventoryItem, type Locale, type StoryArchive, type StoryCartridge, type StoryMode, type StorySave } from './types'

type LegacyStorySave = Omit<StorySave, 'version' | 'locale' | 'characters' | 'partyMemberIds' | 'danger' | 'facts' | 'decisionContext'> & {
  version?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  decisionContext?: string
  locale?: Locale
  characters?: StorySave['characters']
  partyMemberIds?: StorySave['partyMemberIds']
  danger?: Partial<StorySave['danger']>
  facts?: StorySave['facts']
  imageUrl?: string
  imageStatus?: 'idle' | 'queued' | 'generating' | 'ready' | 'failed'
  imagePrompt?: string
}

type PersistedStoryData = StoryArchive | LegacyStorySave

function isArchive(candidate: PersistedStoryData | null | undefined): candidate is StoryArchive {
  return Boolean(candidate && 'worlds' in candidate && candidate.worlds && typeof candidate.worlds === 'object')
}

function readLegacyLocal(cartridgeId: string): LegacyStorySave | null {
  try {
    const raw = alteruLocalStorage.getItem(`stateful-story-${cartridgeId}-save`)
    return raw ? JSON.parse(raw) as LegacyStorySave : null
  } catch { return null }
}

function readSharedTemplateLocal(cartridgeId: string): LegacyStorySave | null {
  try {
    const raw = alteruLocalStorage.getItem('stateful-story-template-save')
    if (!raw) return null
    const stored = JSON.parse(raw) as PersistedStoryData
    return isArchive(stored) ? (stored.worlds[cartridgeId] as LegacyStorySave | undefined) ?? null : stored.cartridgeId === cartridgeId ? stored : null
  } catch { return null }
}

function repairMockLoop(candidate: LegacyStorySave, cartridge: StoryCartridge): LegacyStorySave {
  const fallbackIndexes = new Set<number>()
  candidate.blocks.forEach((block, index) => {
    if (block.kind === 'narration' && /世界没有关闭，只是把新的线索推到下一页|world does not close; it carries a new clue onto the next page/i.test(block.text)) fallbackIndexes.add(index)
  })
  if (fallbackIndexes.size === 0) return candidate
  const blocks = candidate.blocks.filter((block, index) => !fallbackIndexes.has(index) && !(block.kind === 'event' && block.id.startsWith('action-') && fallbackIndexes.has(index + 1)))
  return {
    ...candidate,
    blocks,
    scene: Math.max(0, candidate.scene - fallbackIndexes.size),
    choices: [{ id: `recovered-${candidate.scene}`, label: cartridge.copy.continue }],
    sessionEnded: false,
    lastActionId: undefined,
  }
}

function recoverPersistedChoices(candidate: LegacyStorySave, cartridge: StoryCartridge): LegacyStorySave {
  const existing = candidate.choices ?? []
  const isGenericFallback = existing.length === 1 && existing[0].label === cartridge.copy.continue
  if (existing.length > 1 || (existing.length === 1 && !isGenericFallback)) return candidate
  let lastActionIndex = -1
  candidate.blocks.forEach((block, index) => { if (block.kind === 'event' && block.id.startsWith('action-')) lastActionIndex = index })
  const tail = candidate.blocks.slice(lastActionIndex + 1).filter((block) => block.kind !== 'image').map((block) => block.text).join('\n')
  const parsed = parseStoryProtocol(tail, candidate.locale ?? cartridge.locale)
  const recovered = parsed.commands.find((command) => command.type === 'choices')
  if (!recovered || recovered.type !== 'choices' || recovered.choices.length < 2) return candidate
  const labels = new Set(recovered.choices)
  const optionLine = /^\s*(?:(?:选项|选择|行动)\s*[一二三四五\dA-Ea-e]+\s*[：:.、)]|(?:\d{1,2}|[A-Ea-e]|[一二三四五])\s*[.、:：)]|[①②③④⑤]|[-*•])\s*(.+?)\s*$/
  const blocks = candidate.blocks.filter((block, index) => {
    if (index <= lastActionIndex || block.kind !== 'narration') return true
    const label = block.text.match(optionLine)?.[1]?.replace(/[。.;；]+$/, '').trim()
    return !label || !labels.has(label)
  })
  return {
    ...candidate,
    blocks,
    choices: recovered.choices.map((label, index) => ({ id: `recovered-choice-${candidate.scene}-${index}`, label })),
  }
}

function normalizeSave(candidate: LegacyStorySave | null | undefined, cartridge: StoryCartridge, incomingChatId?: string): StorySave {
  if (!candidate || candidate.cartridgeId !== cartridge.id || !Array.isArray(candidate.blocks)) return createInitialSave(cartridge, incomingChatId)
  if (incomingChatId && candidate.remoteChatId && candidate.remoteChatId !== incomingChatId) return createInitialSave(cartridge, incomingChatId)
  const repaired = recoverPersistedChoices(repairMockLoop(candidate, cartridge), cartridge)
  let blocks = repaired.blocks
  if (!blocks.some((block) => block.kind === 'image')) {
    const legacyPrompt = repaired.imagePrompt?.trim() ?? ''
    const canRestoreImage = repaired.scene === 0 || Boolean(legacyPrompt || repaired.imageUrl)
    if (canRestoreImage) {
      const prompt = legacyPrompt || (repaired.scene === 0 ? cartridge.opening.imagePrompt : '')
      const status = repaired.imageUrl
        ? 'ready'
        : repaired.imageStatus === 'generating'
          ? 'queued'
          : repaired.imageStatus || (repaired.entered && prompt ? 'queued' : 'idle')
      blocks = [...blocks, createImageBlock(`image-${repaired.scene}`, repaired.location, prompt, status, repaired.imageUrl)]
    }
  }
  const initialItems = new Map(cartridge.initialInventory.map((item) => [item.id, item]))
  const inventory = (repaired.inventory ?? cartridge.initialInventory).map((item) => {
    const definition = initialItems.get(item.id)
    return {
      ...definition, ...item,
      detail: item.detail ?? definition?.detail, effect: item.effect ?? definition?.effect, lore: item.lore ?? definition?.lore,
      metrics: item.metrics ?? definition?.metrics, imagePrompt: item.imagePrompt ?? definition?.imagePrompt,
      imageStatus: item.imageStatus === 'generating' ? 'queued' : item.imageStatus ?? (item.imageUrl ? 'ready' : 'idle'),
    }
  })
  const initialPlaces = new Map(cartridge.initialMap.map((node) => [node.id, node]))
  const map = (repaired.map ?? cartridge.initialMap).map((node) => {
    const definition = initialPlaces.get(node.id)
    return {
      ...definition, ...node,
      visited: node.visited ?? Boolean(node.current || node.id.startsWith('map-')),
      detail: node.detail ?? definition?.detail, lore: node.lore ?? definition?.lore, facts: node.facts ?? definition?.facts,
    }
  })
  const characterState = normalizeCharacterState(repaired, cartridge)
  const normalized = {
    ...repaired, ...characterState, version: 9, locale: repaired.locale ?? cartridge.locale,
    decisionContext: repaired.version === 9 ? repaired.decisionContext ?? '' : '',
    facts: { ...(cartridge.initialFacts ?? {}), ...(repaired.facts ?? {}) },
    remoteChatId: incomingChatId || repaired.remoteChatId, blocks, inventory, map,
    danger: normalizeDangerState(repaired.danger),
  } as StorySave
  if (!normalized.sessionEnded && normalized.choices.length === 0) normalized.choices = createRecoveryChoices(normalized, cartridge)
  return upgradePendingSceneImagePrompts(normalized, cartridge)
}

function inventoryImagePrompt(item: InventoryItem, cartridge: StoryCartridge): string {
  const direction = cartridge.itemImageDirection ?? 'elegant in-world artifact study with tactile natural materials and restrained directional light'
  const content = item.imagePrompt ?? `A single inventory object from ${cartridge.copy.title}: ${item.label}. ${item.detail ?? ''} ${item.effect ?? ''} ${item.lore ?? ''}`
  return `Create an inventory artifact plate for ${cartridge.copy.title}. Content brief: ${content}. Art direction: ${direction}. Follow only this text-defined medium, line treatment, palette, surface texture, lighting contrast, and degree of realism. Do not borrow any location, landmark, character, composition, or prop from the game's cover or opening scene. One object or one tightly grouped item set only, centered still life, square composition, no people, no hands, no text, no letters, no labels, no logo, no UI.`
}

export function useStoryEngine(cartridge: StoryCartridge, initialMode: StoryMode, incomingChatId?: string, imageIdentity: { ready: boolean; refUrl?: string } = { ready: true }) {
  const cloud = useGameSave<PersistedStoryData>('city-of-tides-v2')
  const [save, setSave] = useState<StorySave>(() => createInitialSave(cartridge, incomingChatId))
  const [mode, setMode] = useState<StoryMode>(initialMode)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<AdapterProgress | null>(null)
  const [error, setError] = useState('')
  const [pendingAction, setPendingAction] = useState('')
  const [failedAction, setFailedAction] = useState<{ action: string; locale: Locale } | null>(null)
  const seeded = useRef(false)
  const imageAttempt = useRef('')
  const imageBusy = useRef(false)
  const lastImageCallAt = useRef(0)
  const [imageWorkerTick, setImageWorkerTick] = useState(0)
  const saveRef = useRef(save)
  const archiveRef = useRef<StoryArchive>({ version: 1, worlds: {} })
  const { generate } = useGenImage()
  const persist = cloud.persist

  useEffect(() => { recordAuthorityShadowSample(save, cartridge) }, [cartridge, save])

  useEffect(() => {
    if (!cloud.loaded || seeded.current) return
    seeded.current = true
    const stored = cloud.savedData
    const archive: StoryArchive = isArchive(stored)
      ? { ...stored, worlds: { ...stored.worlds } }
      : { version: 1, worlds: stored?.cartridgeId ? { [stored.cartridgeId]: stored as StorySave } : {} }
    const legacyLocal = archive.worlds[cartridge.id] ? null : readLegacyLocal(cartridge.id) ?? readSharedTemplateLocal(cartridge.id)
    const next = normalizeSave(archive.worlds[cartridge.id] as LegacyStorySave | undefined || legacyLocal, cartridge, incomingChatId)
    const nextArchive: StoryArchive = { ...archive, version: 1, worlds: { ...archive.worlds, [cartridge.id]: next } }
    archiveRef.current = nextArchive
    saveRef.current = next
    setSave(next)
    if (next.remoteChatId) {
      setMode('remote')
      const url = new URL(window.location.href)
      if (url.searchParams.get('chat_id') !== next.remoteChatId) {
        url.searchParams.set('chat_id', next.remoteChatId)
        window.history.replaceState({}, '', url)
      }
    }
    if (stored || legacyLocal || incomingChatId) persist(nextArchive)
  }, [cartridge, cloud.loaded, cloud.savedData, incomingChatId, persist])

  const commit = useCallback((recipe: StorySave | ((current: StorySave) => StorySave)) => {
    setSave((current) => {
      const next = typeof recipe === 'function' ? recipe(current) : recipe
      saveRef.current = next
      const archive = archiveRef.current
      const nextArchive: StoryArchive = { ...archive, version: 1, worlds: { ...archive.worlds, [cartridge.id]: next } }
      archiveRef.current = nextArchive
      persist(nextArchive)
      return next
    })
  }, [cartridge.id, persist])

  const queuedSceneImage = save.blocks.find((block) => block.kind === 'image' && block.data?.status === 'queued')
  const queuedItemImage = save.inventory.find((item) => item.imageStatus === 'queued')
  const queuedImageKey = queuedSceneImage ? `scene:${queuedSceneImage.id}` : queuedItemImage ? `item:${queuedItemImage.id}` : ''

  useEffect(() => {
    if (!save.entered || !queuedImageKey || imageBusy.current || imageAttempt.current === queuedImageKey) return
    const isScene = Boolean(queuedSceneImage)
    if (isScene && !imageIdentity.ready) return
    const prompt = queuedSceneImage ? String(queuedSceneImage.data?.prompt ?? '') : queuedItemImage ? inventoryImagePrompt(queuedItemImage, cartridge) : ''
    if (!prompt) return
    imageBusy.current = true
    imageAttempt.current = queuedImageKey
    const entityId = queuedSceneImage?.id ?? queuedItemImage!.id
    commit((current) => isScene
      ? updateImageBlock(current, entityId, { status: 'generating' })
      : updateInventoryItemImage(current, entityId, { status: 'generating' }))
    ;(async () => {
      try {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            const gap = Math.max(0, 3000 - (Date.now() - lastImageCallAt.current))
            if (gap) await new Promise((resolve) => window.setTimeout(resolve, gap))
            const visibility = queuedSceneImage?.data?.playerVisible
            const usePlayerReference = Boolean(isScene && imageIdentity.refUrl && (
              visibility === 'true' || (visibility !== 'false' && shouldUsePlayerImageReference(prompt))
            ))
            const identityPrompt = usePlayerReference
              ? `${prompt}. Use the person in the reference image as the player protagonist in this scene. Preserve their recognizable facial features and overall appearance, while adapting clothing, pose, lighting, and camera distance naturally to this fictional world. Keep the environment and story event visually dominant; do not turn the scene into a selfie or portrait.`
              : prompt
            lastImageCallAt.current = Date.now()
            const url = await generate(usePlayerReference
              ? { prompt: identityPrompt, ref_url: imageIdentity.refUrl }
              : { prompt: identityPrompt })
            if (imageAttempt.current === queuedImageKey) commit((current) => isScene
              ? updateImageBlock(current, entityId, { status: 'ready', url })
              : updateInventoryItemImage(current, entityId, { status: 'ready', url, styleVersion: ITEM_IMAGE_STYLE_VERSION }))
            return
          } catch {
            if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 3000 : 8000))
          }
        }
        if (imageAttempt.current === queuedImageKey) commit((current) => isScene
          ? updateImageBlock(current, entityId, { status: 'failed' })
          : updateInventoryItemImage(current, entityId, { status: 'failed' }))
      } finally {
        imageBusy.current = false
        setImageWorkerTick((tick) => tick + 1)
      }
    })()
  }, [cartridge, commit, generate, imageIdentity.ready, imageIdentity.refUrl, imageWorkerTick, queuedImageKey, queuedItemImage, queuedSceneImage, save.entered])

  const enter = useCallback(() => commit((current) => {
    const openingImage = current.blocks.find((block) => block.kind === 'image')
    const entered = { ...current, locale: cartridge.locale, entered: true }
    return openingImage && openingImage.data?.status === 'idle' ? updateImageBlock(entered, openingImage.id, { status: 'queued' }) : entered
  }), [cartridge.locale, commit])

  const act = useCallback(async (action: string, actionLocale: Locale = cartridge.locale) => {
    if (!action.trim() || busy) return
    const normalizedAction = action.trim()
    const activeCartridge = resolveCartridge(cartridge.id, actionLocale)
    setBusy(true); setError(''); setFailedAction(null); setPendingAction(normalizedAction); setProgress({ label: t(actionLocale, 'actionWritten'), percent: 8 })
    try {
      const adapter = mode === 'remote' ? remoteAdapter : mode === 'aigram' ? aigramAdapter : mockAdapter
      const base = localizeKnownState(saveRef.current, cartridge, activeCartridge)
      const domainResolution = resolveDomainAction(base, activeCartridge, normalizedAction)
      const dangerDirective = domainResolution ? undefined : buildDangerDirective(base, activeCartridge, normalizedAction)
      const result = domainResolution
        ? { content: domainResolution.text }
        : await adapter.send(normalizedAction, { cartridge: activeCartridge, save: base, actionId: normalizedAction, locale: actionLocale, dangerDirective }, setProgress)
      const parsed = parseStoryProtocol(result.content, actionLocale)
      commit((current) => applyParsedScene(localizeKnownState(current, cartridge, activeCartridge), parsed, activeCartridge, normalizedAction, result.imagePrompt, result.imageSubject, dangerDirective, domainResolution))
      setPendingAction('')
      setProgress(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setFailedAction({ action: normalizedAction, locale: actionLocale })
      setPendingAction('')
      setProgress(null)
    } finally { setBusy(false) }
  }, [busy, cartridge, commit, mode])

  const retryAction = useCallback(() => { if (failedAction) void act(failedAction.action, failedAction.locale) }, [act, failedAction])
  const useAigramFallback = useCallback(() => { setMode('aigram'); setError('') }, [])
  const retryImage = useCallback((blockId: string) => { imageAttempt.current = ''; commit((current) => updateImageBlock(current, blockId, { status: 'queued' })) }, [commit])
  const prepareInventoryImages = useCallback(() => {
    imageAttempt.current = ''
    commit((current) => {
      const needsPreparation = current.inventory.some((item) => !item.imageUrl || item.imageStyleVersion !== ITEM_IMAGE_STYLE_VERSION || item.imageStatus === 'failed')
      if (!needsPreparation) return current
      return {
        ...current,
        inventory: current.inventory.map((item) => {
          const needsImage = !item.imageUrl || item.imageStyleVersion !== ITEM_IMAGE_STYLE_VERSION || item.imageStatus === 'failed'
          return needsImage ? { ...item, imageStyleVersion: undefined, imageStatus: 'queued' as const } : item
        }),
      }
    })
  }, [commit])
  const restartWorld = useCallback(() => {
    if (busy) return
    imageAttempt.current = `restart:${Date.now()}`
    setError(''); setFailedAction(null); setPendingAction(''); setProgress(null)
    const fresh = createInitialSave(cartridge)
    const archive = archiveRef.current
    const nextArchive: StoryArchive = { ...archive, version: 1, worlds: { ...archive.worlds, [cartridge.id]: fresh } }
    archiveRef.current = nextArchive
    saveRef.current = fresh
    setSave(fresh)
    persist(nextArchive)
    const url = new URL(window.location.href)
    url.searchParams.delete('chat_id')
    window.history.replaceState({}, '', url)
    setMode(url.searchParams.get('story_mode') === 'demo' ? 'demo' : 'aigram')
  }, [busy, cartridge, persist])
  return { save, mode, setMode, busy, progress, error, pendingAction, canRetry: Boolean(failedAction), enter, act, retryAction, useAigramFallback, retryImage, prepareInventoryImages, restartWorld, loaded: cloud.loaded && seeded.current, clear: cloud.clear }
}
