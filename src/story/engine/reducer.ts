import { SCENE_IMAGE_PROMPT_VERSION, type CharacterDefinition, type DangerDirective, type DomainActionResolution, type ImageBlockStatus, type ParsedCommand, type ParsedScene, type SceneImageSubject, type StoryBlock, type StoryCartridge, type StoryCharacter, type StorySave } from '../types'
import { t } from '../i18n'
import { chooseSceneImage } from './imageDirector'
import { createInitialDangerState, normalizeDangerState, settleDangerTurn } from './dangerDirector'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function createInitialSave(cartridge: StoryCartridge, remoteChatId?: string): StorySave {
  const initialPartyMemberIds = cartridge.initialPartyMemberIds ?? cartridge.characters.filter((character) => character.initialStatus === 'companion').map((character) => character.id)
  return {
    version: 7, cartridgeId: cartridge.id, locale: cartridge.locale, remoteChatId, entered: false, scene: 0,
    location: cartridge.opening.location, time: cartridge.opening.time, objective: cartridge.opening.objective,
    stats: Object.fromEntries(cartridge.statDefinitions.map((stat) => [stat.id, stat.initial])), facts: { ...(cartridge.initialFacts ?? {}) },
    blocks: [...cartridge.opening.blocks, createImageBlock('image-0', cartridge.opening.location, cartridge.opening.imagePrompt, 'idle')],
    choices: cartridge.opening.choices, map: cartridge.initialMap.map((node) => ({ ...node, visited: node.visited ?? Boolean(node.current), facts: node.facts ? [...node.facts] : undefined })),
    inventory: cartridge.initialInventory.map((item) => ({ ...item, metrics: item.metrics?.map((metric) => ({ ...metric })), imageStatus: item.imageUrl ? 'ready' : 'idle' })),
    characters: cartridge.characters.filter((character) => !character.hiddenUntilIntroduced).map((character) => {
      const state = characterFromDefinition(character)
      if (initialPartyMemberIds.includes(state.id)) state.status = 'companion'
      return state
    }),
    partyMemberIds: initialPartyMemberIds,
    relationships: [],
    danger: createInitialDangerState(),
    sessionEnded: false,
  }
}

type CharacterCommand = Extract<ParsedCommand, { type: 'character_update' | 'party_change' }>

function characterFromDefinition(character: CharacterDefinition): StoryCharacter {
  return {
    ...character,
    skills: character.skills.map((skill) => ({ ...skill })),
    status: character.initialStatus ?? 'known', origin: 'cartridge', updatedAtScene: 0,
  }
}

function normalizedName(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[\s·•._-]+/g, '')
}

function resolveCharacter(save: StorySave, command: CharacterCommand, index: number, cartridge: StoryCartridge): StoryCharacter {
  const byId = command.characterId ? save.characters.find((character) => character.id === command.characterId) : undefined
  const byName = save.characters.find((character) => normalizedName(character.name) === normalizedName(command.character))
  const existing = byId && normalizedName(byId.name) === normalizedName(command.character) ? byId : byName
  if (existing) {
    existing.role = command.role ?? existing.role
    existing.detail = command.detail ?? existing.detail
    existing.lore = command.lore ?? existing.lore
    existing.vitality = command.vitality == null ? existing.vitality : clamp(command.vitality, 0, 100)
    existing.stress = command.stress == null ? existing.stress : clamp(command.stress, 0, 100)
    existing.skills = command.skills?.map((skill) => ({ ...skill })) ?? existing.skills
    existing.lastKnownLocation = save.location
    existing.updatedAtScene = save.scene
    return existing
  }
  const created: StoryCharacter = {
    id: `npc-${save.scene}-${index}`,
    name: command.character,
    role: command.role ?? t(cartridge.locale, command.type === 'party_change' && command.change === 'add' ? 'companion' : 'knownPerson'),
    vitality: clamp(command.vitality ?? 100, 0, 100),
    stress: clamp(command.stress ?? 0, 0, 100),
    skills: command.skills?.map((skill) => ({ ...skill })) ?? [],
    detail: command.detail,
    lore: command.lore,
    status: 'known', origin: 'generated', lastKnownLocation: save.location, updatedAtScene: save.scene,
  }
  save.characters.push(created)
  return created
}

function hasVisibleDeparture(parsed: ParsedScene, characterName: string): boolean {
  const visible = parsed.blocks.map((block) => `${block.speaker ?? ''} ${block.text}`).join('\n')
  if (!visible.includes(characterName)) return false
  return /离开|离队|分开|告别|留下|失踪|死亡|独自前往|leave|depart|separat|farewell|stay behind|missing|died|dead|goes alone/i.test(visible)
}

type LegacyCharacterState = Pick<StorySave, 'blocks' | 'relationships'> & Partial<Pick<StorySave, 'characters' | 'partyMemberIds'>>

export function normalizeCharacterState(candidate: LegacyCharacterState, cartridge: StoryCartridge): Pick<StorySave, 'characters' | 'partyMemberIds' | 'relationships'> {
  const staticById = new Map(cartridge.characters.map((character) => [character.id, character]))
  const visibleNarrative = candidate.blocks.map((block) => `${block.speaker ?? ''} ${block.text}`).join('\n')
  const savedParty = new Set(Array.isArray(candidate.partyMemberIds) ? candidate.partyMemberIds : [])
  const inputCharacters = (Array.isArray(candidate.characters) ? candidate.characters : []).filter((character) => {
    const definition = staticById.get(character.id)
    return !definition?.hiddenUntilIntroduced || savedParty.has(character.id) || character.updatedAtScene > 0 || visibleNarrative.includes(character.name)
  })
  const characters: StoryCharacter[] = inputCharacters.map((character) => {
    const definition = staticById.get(character.id)
    return {
      ...definition, ...character,
      name: character.name || definition?.name || character.id,
      role: character.role || definition?.role || t(cartridge.locale, 'knownPerson'),
      vitality: clamp(Number.isFinite(character.vitality) ? character.vitality : definition?.vitality ?? 100, 0, 100),
      stress: clamp(Number.isFinite(character.stress) ? character.stress : definition?.stress ?? 0, 0, 100),
      skills: (character.skills ?? definition?.skills ?? []).map((skill) => ({ ...skill })),
      status: character.status === 'companion' || character.status === 'departed' ? character.status : 'known',
      origin: character.origin === 'generated' ? 'generated' : 'cartridge',
      updatedAtScene: Number.isFinite(character.updatedAtScene) ? character.updatedAtScene : 0,
    }
  })
  cartridge.characters.forEach((definition) => {
    if (!definition.hiddenUntilIntroduced && !characters.some((character) => character.id === definition.id)) characters.push(characterFromDefinition(definition))
  })
  const findOrCreate = (name: string, id?: string): StoryCharacter => {
    const found = (id ? characters.find((character) => character.id === id) : undefined)
      ?? characters.find((character) => normalizedName(character.name) === normalizedName(name))
    if (found) return found
    const created: StoryCharacter = {
      id: id && !characters.some((character) => character.id === id) ? id : `legacy-npc-${characters.length + 1}`,
      name, role: t(cartridge.locale, 'knownPerson'), vitality: 100, stress: 0, skills: [],
      status: 'known', origin: 'generated', updatedAtScene: 0,
    }
    characters.push(created)
    return created
  }
  const explicitParty = new Set(Array.isArray(candidate.partyMemberIds) ? candidate.partyMemberIds.filter((id) => characters.some((character) => character.id === id)) : [])
  if (!candidate.partyMemberIds) {
    const initialPartyIds = cartridge.initialPartyMemberIds ?? cartridge.characters.filter((character) => character.initialStatus === 'companion').map((character) => character.id)
    initialPartyIds.forEach((id) => explicitParty.add(id))
    characters.filter((character) => character.status === 'companion').forEach((character) => explicitParty.add(character.id))
    candidate.blocks.forEach((block) => {
      if (block.kind !== 'event' || !block.id.startsWith('effect-')) return
      const encodedChange = block.data?.partyChange
      const encodedId = typeof block.data?.characterId === 'string' ? block.data.characterId : undefined
      let name = block.text.trim()
      let change: 'add' | 'remove' | undefined = encodedChange === 'add' || encodedChange === 'remove' ? encodedChange : undefined
      const suffixes: Array<[string, 'add' | 'remove']> = [
        ['加入了同行者', 'add'], ['离开了同行者', 'remove'], [' joined the party', 'add'], [' left the party', 'remove'],
      ]
      if (!change) {
        const suffix = suffixes.find(([text]) => name.endsWith(text))
        if (!suffix) return
        name = name.slice(0, -suffix[0].length).trim()
        change = suffix[1]
      } else {
        const suffix = suffixes.find(([text]) => name.endsWith(text))
        if (suffix) name = name.slice(0, -suffix[0].length).trim()
      }
      if (!name && !encodedId) return
      const character = findOrCreate(name || encodedId!, encodedId)
      if (change === 'add') {
        explicitParty.add(character.id)
        character.status = 'companion'
      } else {
        explicitParty.delete(character.id)
        character.status = 'departed'
      }
    })
  }
  const relationships = (candidate.relationships ?? []).map((event) => {
    const character = event.characterId ? characters.find((entry) => entry.id === event.characterId) : findOrCreate(event.actor)
    return { ...event, characterId: character?.id }
  })
  characters.forEach((character) => {
    if (explicitParty.has(character.id)) character.status = 'companion'
    else if (character.status === 'companion') character.status = 'known'
  })
  return { characters, partyMemberIds: [...explicitParty], relationships }
}

export function createImageBlock(id: string, location: string, prompt: string, status: ImageBlockStatus, url = '', metadata?: Record<string, string>): StoryBlock {
  return { id, kind: 'image', text: location, data: { prompt, status, url, ...metadata } }
}

export function updateImageBlock(save: StorySave, blockId: string, patch: { status?: ImageBlockStatus; url?: string }): StorySave {
  return {
    ...save,
    blocks: save.blocks.map((block) => block.id === blockId && block.kind === 'image'
      ? { ...block, data: { ...block.data, ...patch } }
      : block),
  }
}

export function updateInventoryItemImage(save: StorySave, itemId: string, patch: { status?: ImageBlockStatus; url?: string; styleVersion?: number }): StorySave {
  return {
    ...save,
    inventory: save.inventory.map((item) => item.id === itemId
      ? {
        ...item,
        imageStatus: patch.status ?? item.imageStatus,
        imageUrl: patch.url ?? item.imageUrl,
        imageStyleVersion: patch.styleVersion ?? item.imageStyleVersion,
      }
      : item),
  }
}

export function localizeKnownState(save: StorySave, from: StoryCartridge, to: StoryCartridge): StorySave {
  if (from.locale === to.locale) return save
  const sourceNodeByLabel = new Map(from.initialMap.map((node) => [node.label, node.id]))
  const targetNodeById = new Map(to.initialMap.map((node) => [node.id, node]))
  const map = save.map.map((node) => {
    const target = targetNodeById.get(node.id)
    const connectedId = node.connectedTo ? sourceNodeByLabel.get(node.connectedTo) : undefined
    return target ? {
      ...node, label: target.label, connectedTo: connectedId ? targetNodeById.get(connectedId)?.label : node.connectedTo,
      detail: target.detail ?? node.detail, lore: target.lore ?? node.lore, facts: target.facts ?? node.facts,
    } : node
  })
  const locationId = sourceNodeByLabel.get(save.location)
  const openingLocation = save.location === from.opening.location ? to.opening.location : undefined
  const inventoryById = new Map(to.initialInventory.map((item) => [item.id, item]))
  const charactersById = new Map(to.characters.map((character) => [character.id, character]))
  return {
    ...save,
    locale: to.locale,
    location: openingLocation ?? (locationId ? targetNodeById.get(locationId)?.label ?? save.location : save.location),
    time: save.time === from.opening.time ? to.opening.time : save.time,
    objective: save.objective === from.opening.objective ? to.opening.objective : save.objective,
    map,
    inventory: save.inventory.map((item) => {
      const target = inventoryById.get(item.id)
      return target ? {
        ...item, label: target.label, detail: target.detail ?? item.detail, effect: target.effect ?? item.effect,
        lore: target.lore ?? item.lore, metrics: target.metrics ?? item.metrics, imagePrompt: target.imagePrompt ?? item.imagePrompt,
      } : item
    }),
    characters: save.characters.map((character) => {
      const target = charactersById.get(character.id)
      return target ? { ...character, name: target.name, role: target.role, detail: target.detail ?? character.detail, lore: target.lore ?? character.lore, skills: target.skills.map((skill) => ({ ...skill })) } : character
    }),
  }
}

function changeBlock(id: string, text: string, data?: Record<string, string | number>): StoryBlock {
  return { id, kind: 'change', text, data }
}

function shortChoiceContext(value: string, maxLength: number): string {
  const clean = value.replace(/[\n\r\t]+/g, ' ').replace(/[“”"']/g, '').trim()
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1).trim()}…` : clean
}

export function createRecoveryChoices(save: Pick<StorySave, 'scene' | 'location' | 'objective' | 'partyMemberIds'>, cartridge: StoryCartridge): StorySave['choices'] {
  const location = shortChoiceContext(save.location, cartridge.locale === 'zh' ? 14 : 24)
  const objective = shortChoiceContext(save.objective, cartridge.locale === 'zh' ? 18 : 32)
  const hasParty = save.partyMemberIds.length > 0
  const labels = cartridge.locale === 'zh'
    ? [
        `观察${location || '周围'}的新变化`,
        objective ? `追查“${objective}”的线索` : '检查与刚才行动有关的线索',
        hasParty ? '和同行者商量下一步' : '换一种方式处理当前局面',
      ]
    : [
        `Observe what changed around ${location || 'this place'}`,
        objective ? `Trace a clue about “${objective}”` : 'Inspect clues connected to the last action',
        hasParty ? 'Discuss the next move with your companions' : 'Try another approach to the current situation',
      ]
  return labels.map((label, index) => ({ id: `recovery-${save.scene}-${index}`, label }))
}

function validChoiceLabels(labels: string[]): string[] {
  const clean = labels.map((label) => label.trim()).filter((label) => label.length >= 2 && label.length <= 96)
  return clean.length >= 2 && clean.length <= 5 && new Set(clean).size === clean.length ? clean : []
}

function cleanInferredItemLabel(value: string): string {
  return value
    .replace(/^[\s“”"「」『』]+|[\s“”"「」『』]+$/g, '')
    .replace(/^(?:一|1)\s*(?:个|件|把|枚|份|瓶|块|张|卷|只)\s*/, '')
    .replace(/^(?:the|an?)\s+/i, '')
    .trim()
}

function inferInventoryCommands(parsed: ParsedScene, cartridge: StoryCartridge): Extract<ParsedCommand, { type: 'inventory' }>[] {
  const narration = parsed.blocks.filter((block) => block.kind === 'narration').map((block) => block.text).join('\n')
  if (!narration) return []
  const explicit = new Set(parsed.commands.filter((command): command is Extract<ParsedCommand, { type: 'inventory' }> => command.type === 'inventory').map((command) => `${command.action}:${cleanInferredItemLabel(command.item).toLocaleLowerCase()}`))
  const patterns = cartridge.locale === 'zh'
    ? [
        { action: 'add' as const, expression: /你[^。！!？?\n]{0,28}?(?:获得了|得到了|收下了|捡起了?|拾起了?|取走了?|买下了?)([^，,。；;！!？?\n]{1,36})/g },
        { action: 'add' as const, expression: /你把([^，,。；;！!？?\n]{1,36}?)放(?:进|入)了?(?:行囊|背包)/g },
        { action: 'remove' as const, expression: /你[^。！!？?\n]{0,28}?(?:失去了|交出了|丢弃了|用掉了|消耗了)([^，,。；;！!？?\n]{1,36})/g },
      ]
    : [
        { action: 'add' as const, expression: /\byou [^.!?\n]{0,48}?\b(?:obtained|received|picked up|took|bought|kept)\s+([^.,;!?\n]{1,48})/gi },
        { action: 'add' as const, expression: /\byou put\s+([^.,;!?\n]{1,48}?)\s+in(?:to)? (?:your )?(?:pack|bag|inventory)\b/gi },
        { action: 'remove' as const, expression: /\byou [^.!?\n]{0,48}?\b(?:lost|gave away|discarded|consumed|used up)\s+([^.,;!?\n]{1,48})/gi },
      ]
  const inferred: Extract<ParsedCommand, { type: 'inventory' }>[] = []
  const seen = new Set<string>()
  patterns.forEach(({ action, expression }) => {
    let match: RegExpExecArray | null
    while ((match = expression.exec(narration))) {
      if (/(?:可以|能够|也许|或许|打算|准备|\bcan\b|\bcould\b|\bmay\b|\bmight\b|\bplan(?:ned)? to\b)/i.test(match[0])) continue
      const item = cleanInferredItemLabel(match[1])
      const key = `${action}:${item.toLocaleLowerCase()}`
      if (item.length < 2 || seen.has(key) || explicit.has(key)) continue
      seen.add(key)
      inferred.push({ type: 'inventory', action, item, count: 1 })
    }
  })
  return inferred.slice(0, 3)
}

export function applyParsedScene(
  save: StorySave,
  parsed: ParsedScene,
  cartridge: StoryCartridge,
  actionId: string,
  imagePrompt?: string,
  imageSubject?: SceneImageSubject,
  dangerDirective?: DangerDirective,
  domainResolution?: DomainActionResolution,
): StorySave {
  const next: StorySave = {
    ...save, locale: cartridge.locale, scene: save.scene + 1,
    blocks: [...save.blocks, { id: `action-${save.scene + 1}`, kind: 'event', text: actionId }, ...parsed.blocks],
    choices: [], relationships: [...save.relationships],
    map: save.map.map((node) => ({ ...node })), inventory: save.inventory.map((item) => ({ ...item })),
    characters: save.characters.map((character) => ({ ...character, skills: character.skills.map((skill) => ({ ...skill })) })),
    partyMemberIds: [...save.partyMemberIds],
    stats: { ...save.stats },
    facts: { ...save.facts },
    danger: normalizeDangerState(save.danger),
    sessionEnded: false, lastActionId: actionId,
  }
  const effects: StoryBlock[] = []
  let dangerCheckAdded = false

  const commands = domainResolution ? [] : [...parsed.commands, ...inferInventoryCommands(parsed, cartridge)]
  commands.forEach((command, index) => {
    const effectId = `effect-${next.scene}-${index}`
    if (command.type === 'choices') {
      const labels = validChoiceLabels(command.choices)
      // Ignore malformed late tags instead of letting them erase an earlier
      // valid choice set recovered from prose.
      if (labels.length) next.choices = labels.map((label, choiceIndex) => ({ id: `${next.scene}-${choiceIndex}`, label }))
    }
    if (command.type === 'widget') {
      const definition = cartridge.statDefinitions.find((stat) => stat.id === command.id)
      if (!definition) return
      const current = next.stats[command.id] ?? definition.initial
      const raw = Number(command.value)
      const requested = command.operation === 'add' ? current + raw : command.operation === 'remove' ? current - raw : raw
      const maxDelta = definition.maxDelta == null ? Number.POSITIVE_INFINITY : Math.max(0, definition.maxDelta)
      const boundedDelta = clamp(requested - current, -maxDelta, maxDelta)
      next.stats[command.id] = clamp(current + boundedDelta, definition.min, definition.max)
      const delta = next.stats[command.id] - current
      effects.push(changeBlock(effectId, `${definition.label} ${delta > 0 ? '+' : ''}${delta}`, { stat: command.id, delta }))
    }
    if (command.type === 'skill_check') {
      const fixed = dangerDirective?.phase === 'resolution' && dangerDirective.check ? dangerDirective.check : undefined
      const check = fixed ?? command
      const succeeded = fixed ? fixed.outcome === 'critical-success' || fixed.outcome === 'success' || fixed.outcome === 'costly-success' : command.result === 'success'
      effects.push({ id: effectId, kind: 'check', text: `${check.skill} · ${succeeded ? t(cartridge.locale, 'checkSuccess') : t(cartridge.locale, 'checkFailure')}`, data: { dc: check.dc, roll: check.roll, modifier: check.modifier, total: check.total, outcome: fixed?.outcome ?? command.result } })
      dangerCheckAdded = Boolean(fixed)
    }
    if (command.type === 'state' && command.value) next.objective = command.value
    if (command.type === 'clock' && command.value) next.time = command.value
    if (command.type === 'fact') next.facts[command.key] = command.value
    if (command.type === 'map_update') {
      next.map.forEach((node) => { node.current = false })
      const existing = next.map.find((node) => node.label === command.location || node.id === command.location)
      if (existing) {
        existing.current = true
        existing.visited = true
        if (command.connectedTo) existing.connectedTo = command.connectedTo
        if (command.detail) existing.detail = command.detail
        if (command.lore) existing.lore = command.lore
        if (command.facts) existing.facts = command.facts
      } else next.map.push({
        id: `map-${next.scene}-${index}`, label: command.location, connectedTo: command.connectedTo, current: true, visited: true,
        detail: command.detail, lore: command.lore, facts: command.facts,
      })
      next.location = command.location
      effects.push({ id: effectId, kind: 'event', text: t(cartridge.locale, 'arrived', { name: command.location }) })
    }
    if (command.type === 'inventory') {
      const existing = next.inventory.find((item) => item.label === command.item || item.id === command.item)
      let changed = false
      if (existing) {
        const before = existing.count
        existing.count = Math.max(0, existing.count + (command.action === 'add' ? command.count : -command.count))
        changed = existing.count !== before
        if (command.rarity) existing.rarity = command.rarity
        if (command.detail) existing.detail = command.detail
        if (command.effect) existing.effect = command.effect
        if (command.lore) existing.lore = command.lore
        if (command.metrics) existing.metrics = command.metrics
        if (command.imagePrompt) existing.imagePrompt = command.imagePrompt
      } else if (command.action === 'add') {
        next.inventory.push({
          id: `item-${next.scene}-${index}`, label: command.item, count: command.count, rarity: command.rarity,
          detail: command.detail, effect: command.effect, lore: command.lore, metrics: command.metrics, imagePrompt: command.imagePrompt,
          imageStatus: 'idle',
        })
        changed = true
      }
      next.inventory = next.inventory.filter((item) => item.count > 0)
      if (changed) effects.push(changeBlock(effectId, `${command.action === 'add' ? t(cartridge.locale, 'gained') : t(cartridge.locale, 'lost')} ${command.item} ×${command.count}`, command.rarity ? { rarity: command.rarity } : undefined))
    }
    if (command.type === 'reputation') {
      const delta = /betray|hostile|distrust|拒绝|背叛/i.test(command.action) ? -1 : 1
      const character = resolveCharacter(next, { type: 'character_update', character: command.npc }, index, cartridge)
      next.relationships.push({ id: effectId, actor: character.name, characterId: character.id, axis: command.action, delta, source: actionId })
      effects.push(changeBlock(effectId, `${command.npc} · ${delta > 0 ? t(cartridge.locale, 'warmer') : t(cartridge.locale, 'colder')}`, { delta }))
    }
    if (command.type === 'character_update') resolveCharacter(next, command, index, cartridge)
    if (command.type === 'party_change') {
      const character = resolveCharacter(next, command, index, cartridge)
      if (command.change === 'add') {
        if (!next.partyMemberIds.includes(character.id)) next.partyMemberIds.push(character.id)
        character.status = 'companion'
        character.joinedAtScene ??= next.scene
        character.leftAtScene = undefined
      } else {
        if (!hasVisibleDeparture(parsed, character.name)) return
        next.partyMemberIds = next.partyMemberIds.filter((id) => id !== character.id)
        character.status = 'departed'
        character.leftAtScene = next.scene
      }
      character.updatedAtScene = next.scene
      effects.push({ id: effectId, kind: 'event', text: `${character.name}${t(cartridge.locale, command.change === 'add' ? 'joined' : 'left')}`, data: { characterId: character.id, partyChange: command.change } })
    }
    if (command.type === 'session_end') {
      next.sessionEnded = true
      effects.push({ id: effectId, kind: 'summary', text: command.reason })
    }
  })

  if (domainResolution?.kind === 'accepted') {
    domainResolution.effects.forEach((effect, index) => {
      const effectId = `domain-${next.scene}-${index}`
      if (effect.type === 'fact') next.facts[effect.key] = effect.value
      if (effect.type === 'stat') {
        const definition = cartridge.statDefinitions.find((stat) => stat.id === effect.id)
        if (!definition) return
        const current = next.stats[effect.id] ?? definition.initial
        next.stats[effect.id] = clamp(current + effect.delta, definition.min, definition.max)
        effects.push(changeBlock(effectId, `${definition.label} ${effect.delta > 0 ? '+' : ''}${effect.delta}`, { stat: effect.id, delta: effect.delta }))
      }
      if (effect.type === 'clock') next.time = effect.value
      if (effect.type === 'objective') next.objective = effect.value
      if (effect.type === 'map') {
        next.map.forEach((node) => { node.current = false })
        const destination = next.map.find((node) => node.id === effect.location || node.label === effect.location)
        if (destination) { destination.current = true; destination.visited = true; next.location = destination.label }
      }
      if (effect.type === 'character') {
        const definition = cartridge.characters.find((character) => character.id === effect.id)
        if (!definition) return
        let character = next.characters.find((entry) => entry.id === definition.id)
        if (!character) { character = characterFromDefinition(definition); next.characters.push(character) }
        character.status = effect.status ?? 'known'
        character.updatedAtScene = next.scene
        if (character.status === 'companion' && !next.partyMemberIds.includes(character.id)) next.partyMemberIds.push(character.id)
      }
    })
  }
  if (domainResolution) next.choices = domainResolution.choices.map((label, index) => ({ id: `${next.scene}-domain-${index}`, label }))

  if (dangerDirective?.phase === 'resolution' && dangerDirective.check && !dangerCheckAdded) {
    const check = dangerDirective.check
    const succeeded = check.outcome === 'critical-success' || check.outcome === 'success' || check.outcome === 'costly-success'
    effects.push({
      id: `danger-check-${next.scene}`, kind: 'check', text: `${check.skill} · ${succeeded ? t(cartridge.locale, 'checkSuccess') : t(cartridge.locale, 'checkFailure')}`,
      data: { dc: check.dc, roll: check.roll, modifier: check.modifier, total: check.total, outcome: check.outcome },
    })
  }
  if (!domainResolution) effects.push(...settleDangerTurn(save, next, parsed, cartridge, dangerDirective))

  // Ordinary scenes must remain playable even when an AI response omits or
  // truncates its machine-readable choices. A real checkpoint may still use
  // the dedicated resume action supplied by the Composer.
  if (!next.sessionEnded && next.choices.length < 2) next.choices = createRecoveryChoices(next, cartridge)

  const image = chooseSceneImage(save, next, parsed, cartridge, imagePrompt, imageSubject)
  next.blocks = [
    ...next.blocks,
    ...effects,
    ...(image.prompt ? [createImageBlock(`image-${next.scene}`, next.location, image.prompt, 'queued', '', {
      source: image.source ?? 'director', reason: image.reason ?? 'cadence', promptVersion: String(SCENE_IMAGE_PROMPT_VERSION),
      playerVisible: image.playerVisible ? 'true' : 'false',
    })] : []),
  ]
  return next
}
