import type { ImageBlockStatus, ParsedScene, StoryBlock, StoryCartridge, StorySave } from '../types'
import { t } from '../i18n'
import { chooseSceneImage } from './imageDirector'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function createInitialSave(cartridge: StoryCartridge, remoteChatId?: string): StorySave {
  return {
    version: 4, cartridgeId: cartridge.id, locale: cartridge.locale, remoteChatId, entered: false, scene: 0,
    location: cartridge.opening.location, time: cartridge.opening.time, objective: cartridge.opening.objective,
    stats: Object.fromEntries(cartridge.statDefinitions.map((stat) => [stat.id, stat.initial])),
    blocks: [...cartridge.opening.blocks, createImageBlock('image-0', cartridge.opening.location, cartridge.opening.imagePrompt, 'idle')],
    choices: cartridge.opening.choices, map: cartridge.initialMap.map((node) => ({ ...node, visited: node.visited ?? Boolean(node.current), facts: node.facts ? [...node.facts] : undefined })),
    inventory: cartridge.initialInventory.map((item) => ({ ...item, metrics: item.metrics?.map((metric) => ({ ...metric })), imageStatus: item.imageUrl ? 'ready' : 'idle' })), relationships: [],
    sessionEnded: false,
  }
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
): StorySave {
  const next: StorySave = {
    ...save, locale: cartridge.locale, scene: save.scene + 1,
    blocks: [...save.blocks, { id: `action-${save.scene + 1}`, kind: 'event', text: actionId }, ...parsed.blocks],
    choices: [], relationships: [...save.relationships],
    map: save.map.map((node) => ({ ...node })), inventory: save.inventory.map((item) => ({ ...item })),
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
      next.relationships.push({ id: effectId, actor: command.npc, axis: command.action, delta, source: actionId })
      effects.push(changeBlock(effectId, `${command.npc} · ${delta > 0 ? t(cartridge.locale, 'warmer') : t(cartridge.locale, 'colder')}`, { delta }))
    }
    if (command.type === 'party_change') effects.push({ id: effectId, kind: 'event', text: `${command.character}${t(cartridge.locale, command.change === 'add' ? 'joined' : 'left')}` })
    if (command.type === 'session_end') {
      next.sessionEnded = true
      effects.push({ id: effectId, kind: 'summary', text: command.reason })
    }
  })

  const image = chooseSceneImage(save, next, parsed, cartridge, imagePrompt)
  next.blocks = [
    ...next.blocks,
    ...effects,
    ...(image.prompt ? [createImageBlock(`image-${next.scene}`, next.location, image.prompt, 'queued', '', {
      source: image.source ?? 'director', reason: image.reason ?? 'cadence',
    })] : []),
  ]
  return next
}
