import { SCENE_IMAGE_PROMPT_VERSION, type CharacterDefinition, type ImageBlockStatus, type ParsedCommand, type ParsedScene, type SceneImageSubject, type StoryBlock, type StoryCartridge, type StoryCharacter, type StorySave } from '../types'
import { t } from '../i18n'
import { chooseSceneImage } from './imageDirector'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function createInitialSave(cartridge: StoryCartridge, remoteChatId?: string): StorySave {
  const initialPartyMemberIds = cartridge.initialPartyMemberIds ?? cartridge.characters.filter((character) => character.initialStatus === 'companion').map((character) => character.id)
  return {
    version: 5, cartridgeId: cartridge.id, locale: cartridge.locale, remoteChatId, entered: false, scene: 0,
    location: cartridge.opening.location, time: cartridge.opening.time, objective: cartridge.opening.objective,
    stats: Object.fromEntries(cartridge.statDefinitions.map((stat) => [stat.id, stat.initial])),
    blocks: [...cartridge.opening.blocks, createImageBlock('image-0', cartridge.opening.location, cartridge.opening.imagePrompt, 'idle')],
    choices: cartridge.opening.choices, map: cartridge.initialMap.map((node) => ({ ...node, visited: node.visited ?? Boolean(node.current), facts: node.facts ? [...node.facts] : undefined })),
    inventory: cartridge.initialInventory.map((item) => ({ ...item, metrics: item.metrics?.map((metric) => ({ ...metric })), imageStatus: item.imageUrl ? 'ready' : 'idle' })),
    characters: cartridge.characters.map((character) => {
      const state = characterFromDefinition(character)
      if (initialPartyMemberIds.includes(state.id)) state.status = 'companion'
      return state
    }),
    partyMemberIds: initialPartyMemberIds,
    relationships: [],
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
  const inputCharacters = Array.isArray(candidate.characters) ? candidate.characters : []
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
    if (!characters.some((character) => character.id === definition.id)) characters.push(characterFromDefinition(definition))
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

export function applyParsedScene(
  save: StorySave,
  parsed: ParsedScene,
  cartridge: StoryCartridge,
  actionId: string,
  imagePrompt?: string,
  imageSubject?: SceneImageSubject,
): StorySave {
  const next: StorySave = {
    ...save, locale: cartridge.locale, scene: save.scene + 1,
    blocks: [...save.blocks, { id: `action-${save.scene + 1}`, kind: 'event', text: actionId }, ...parsed.blocks],
    choices: [], relationships: [...save.relationships],
    map: save.map.map((node) => ({ ...node })), inventory: save.inventory.map((item) => ({ ...item })),
    characters: save.characters.map((character) => ({ ...character, skills: character.skills.map((skill) => ({ ...skill })) })),
    partyMemberIds: [...save.partyMemberIds],
    stats: { ...save.stats },
    sessionEnded: false, lastActionId: actionId,
  }
  const effects: StoryBlock[] = []

  parsed.commands.forEach((command, index) => {
    const effectId = `effect-${next.scene}-${index}`
    if (command.type === 'choices') next.choices = command.choices.map((label, choiceIndex) => ({ id: `${next.scene}-${choiceIndex}`, label }))
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
      effects.push({ id: effectId, kind: 'check', text: `${command.skill} · ${command.result === 'success' ? t(cartridge.locale, 'checkSuccess') : t(cartridge.locale, 'checkFailure')}`, data: { dc: command.dc, roll: command.roll, modifier: command.modifier, total: command.total } })
    }
    if (command.type === 'state' && command.value) next.objective = command.value
    if (command.type === 'clock' && command.value) next.time = command.value
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
      if (existing) {
        existing.count = Math.max(0, existing.count + (command.action === 'add' ? command.count : -command.count))
        if (command.rarity) existing.rarity = command.rarity
        if (command.detail) existing.detail = command.detail
        if (command.effect) existing.effect = command.effect
        if (command.lore) existing.lore = command.lore
        if (command.metrics) existing.metrics = command.metrics
        if (command.imagePrompt) existing.imagePrompt = command.imagePrompt
      } else if (command.action === 'add') next.inventory.push({
        id: `item-${next.scene}-${index}`, label: command.item, count: command.count, rarity: command.rarity,
        detail: command.detail, effect: command.effect, lore: command.lore, metrics: command.metrics, imagePrompt: command.imagePrompt,
        imageStatus: 'idle',
      })
      next.inventory = next.inventory.filter((item) => item.count > 0)
      effects.push(changeBlock(effectId, `${command.action === 'add' ? t(cartridge.locale, 'gained') : t(cartridge.locale, 'lost')} ${command.item} ×${command.count}`, command.rarity ? { rarity: command.rarity } : undefined))
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
