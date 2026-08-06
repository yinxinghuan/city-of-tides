import type { ParsedScene, SceneImageTrigger, StoryCartridge, StorySave } from '../types'

export interface SceneImageDecision {
  prompt?: string
  source?: 'ai' | 'director'
  reason?: 'ai-proposal' | SceneImageTrigger | 'cadence'
}

function lastScheduledScene(save: StorySave): number {
  return save.blocks.reduce((latest, block) => {
    if (block.kind !== 'image') return latest
    const match = block.id.match(/^image-(\d+)$/)
    return match ? Math.max(latest, Number(match[1])) : latest
  }, 0)
}

function firstTrigger(triggers: SceneImageTrigger[], allowed: SceneImageTrigger[]): SceneImageTrigger | undefined {
  return triggers.find((trigger) => allowed.includes(trigger))
}

function detectTriggers(previous: StorySave, parsed: ParsedScene): SceneImageTrigger[] {
  const triggers: SceneImageTrigger[] = []
  for (const command of parsed.commands) {
    if (command.type === 'map_update') {
      const known = previous.map.find((node) => node.label === command.location || node.id === command.location)
      if (!known?.visited) triggers.push('new-location')
    }
    if (command.type === 'inventory' && command.action === 'add' && (command.rarity === 'rare' || command.rarity === 'legendary')) triggers.push('rare-item')
    if (command.type === 'party_change') triggers.push('party-change')
    if (command.type === 'session_end') triggers.push('chapter-checkpoint')
    if (command.type === 'reputation') triggers.push('relationship-change')
    if (command.type === 'state' && command.value && command.value !== previous.objective) triggers.push('objective-change')
    if (command.type === 'skill_check') triggers.push('skill-outcome')
  }
  return [...new Set(triggers)]
}

function focusFor(reason: SceneImageTrigger | 'cadence', parsed: ParsedScene, next: StorySave): string {
  if (reason === 'new-location') return `the first arrival at ${next.location}`
  if (reason === 'rare-item') {
    const item = parsed.commands.find((command) => command.type === 'inventory' && command.action === 'add' && (command.rarity === 'rare' || command.rarity === 'legendary'))
    return item?.type === 'inventory' ? `the discovery of ${item.item}` : 'an important discovery'
  }
  if (reason === 'party-change') {
    const party = parsed.commands.find((command) => command.type === 'party_change')
    return party?.type === 'party_change' ? `${party.character} ${party.change === 'add' ? 'joining' : 'leaving'} the group` : 'a change in the group'
  }
  if (reason === 'chapter-checkpoint') return 'the visible situation at this chapter checkpoint'
  if (reason === 'relationship-change') {
    const relationship = parsed.commands.find((command) => command.type === 'reputation')
    return relationship?.type === 'reputation' ? `a relationship turning point involving ${relationship.npc}` : 'a relationship turning point'
  }
  if (reason === 'objective-change') return `the newly established objective: ${next.objective}`
  if (reason === 'skill-outcome') return 'the visible consequence of the latest attempt'
  return 'the most visually distinctive visible consequence of the latest turn'
}

function buildFallbackPrompt(cartridge: StoryCartridge, next: StorySave, parsed: ParsedScene, reason: SceneImageTrigger | 'cadence'): string {
  const visibleBeat = parsed.blocks
    .filter((block) => block.kind !== 'change' && block.text.trim())
    .slice(-3)
    .map((block) => block.speaker ? `${block.speaker}: ${block.text}` : block.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .slice(0, 620)
  const direction = cartridge.sceneImageDirection ?? `${cartridge.theme.material} story-world editorial illustration`
  return `Cinematic scene from the ongoing story ${cartridge.copy.title}. Location: ${next.location}. Focus on ${focusFor(reason, parsed, next)}. Visible story beat: ${visibleBeat || next.objective}. Show only people, objects, places and consequences already established in the visible story; do not invent future events or hidden information. ${direction}. No readable text, no letters, no logo, no UI, 4:3.`
}

export function chooseSceneImage(
  previous: StorySave,
  next: StorySave,
  parsed: ParsedScene,
  cartridge: StoryCartridge,
  aiPrompt?: string,
): SceneImageDecision {
  const proposal = aiPrompt?.trim()
  if (proposal) {
    const direction = cartridge.sceneImageDirection ?? `${cartridge.theme.material} story-world editorial illustration`
    return {
      prompt: `${proposal}. Follow this cartridge art direction: ${direction}. Show only details already established in the visible story. No readable text, no letters, no logo, no UI, 4:3.`,
      source: 'ai',
      reason: 'ai-proposal',
    }
  }

  const director = cartridge.imageDirector
  if (!director) return {}
  const triggers = detectTriggers(previous, parsed)
  const guaranteed = firstTrigger(triggers, director.guaranteedTriggers)
  if (guaranteed) return { prompt: buildFallbackPrompt(cartridge, next, parsed, guaranteed), source: 'director', reason: guaranteed }

  const turnsSinceImage = next.scene - lastScheduledScene(previous)
  const soft = firstTrigger(triggers, director.softTriggers)
  if (soft && turnsSinceImage >= director.softCooldownTurns) {
    return { prompt: buildFallbackPrompt(cartridge, next, parsed, soft), source: 'director', reason: soft }
  }
  if (turnsSinceImage >= director.maxQuietTurns) {
    return { prompt: buildFallbackPrompt(cartridge, next, parsed, 'cadence'), source: 'director', reason: 'cadence' }
  }
  return {}
}
