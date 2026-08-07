import { SCENE_IMAGE_PROMPT_VERSION, type ParsedScene, type SceneImageTrigger, type StoryCartridge, type StorySave } from '../types'

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

function visibleBeat(parsed: ParsedScene): string {
  return parsed.blocks
    .filter((block) => block.kind !== 'change' && block.kind !== 'image' && block.text.trim())
    .slice(-4)
    .map((block) => block.speaker ? `${block.speaker}: ${block.text}` : block.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .slice(0, 760)
}

function words(value: string): string[] {
  return value.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? []
}

function pairs(value: string): Set<string> {
  const tokens = words(value)
  return new Set(tokens.slice(0, -1).map((token, index) => `${token} ${tokens[index + 1]}`))
}

function carriesOpeningResidue(cartridge: StoryCartridge, next: StorySave, parsed: ParsedScene, proposal: string): boolean {
  if (next.location === cartridge.opening.location) return false
  const directionPairs = pairs(cartridge.sceneImageDirection ?? '')
  const openingReference = `${cartridge.opening.imagePrompt} ${cartridge.sceneImageAvoid ?? ''}`
  const openingPairs = pairs(openingReference)
  const proposalPairs = pairs(proposal)
  const beatPairs = pairs(visibleBeat(parsed))
  let residuePairs = 0
  for (const phrase of proposalPairs) {
    if (openingPairs.has(phrase) && !directionPairs.has(phrase) && !beatPairs.has(phrase)) residuePairs += 1
  }
  const directionWords = new Set(words(cartridge.sceneImageDirection ?? ''))
  const openingWords = new Set(words(openingReference).filter((token) => !directionWords.has(token)))
  const beatWords = new Set(words(visibleBeat(parsed)))
  const proposalWords = new Set(words(proposal))
  let residueWords = 0
  for (const token of proposalWords) {
    if (openingWords.has(token) && !beatWords.has(token)) residueWords += 1
  }
  return residuePairs >= 1 || residueWords >= 2
}

function latestLocation(next: StorySave, parsed: ParsedScene): string {
  const update = [...parsed.commands].reverse().find((command) => command.type === 'map_update')
  return update?.type === 'map_update' ? update.location : next.location
}

function buildScenePrompt(
  cartridge: StoryCartridge,
  next: StorySave,
  parsed: ParsedScene,
  reason: SceneImageTrigger | 'cadence',
  aiProposal?: string,
): string {
  const beat = visibleBeat(parsed) || next.objective
  const proposal = aiProposal?.replace(/\s+/g, ' ').trim().slice(0, 620)
  const acceptedProposal = proposal && !carriesOpeningResidue(cartridge, next, parsed, proposal) ? proposal : ''
  const direction = cartridge.sceneImageDirection ?? `${cartridge.theme.material} story-world editorial illustration`
  return [
    'Create one fresh 4:3 cinematic illustration in the established story world.',
    acceptedProposal ? `Primary shot brief: ${acceptedProposal}.` : `Primary shot focus: ${focusFor(reason, parsed, next)}.`,
    `Latest visible story beat, which overrides older continuity hints: ${beat}.`,
    `Current location hint: ${latestLocation(next, parsed)}. Use it only when consistent with the latest visible beat; never drag an earlier location into a newer scene.`,
    `Mandatory art direction: ${direction}.`,
    'Compose one readable moment with one dominant action and at most two focal subjects. Choose a camera position, scale, lighting pattern and silhouette that differ from earlier images.',
    'Ignore all cover art and opening-scene imagery. Derive the depicted location, action, subjects, props and weather only from the primary shot brief and latest visible story beat.',
    'Show only people, objects, places and consequences established in the latest visible story. No montage, split screen, flash-forward, readable text, letters, logo, border, poster layout or UI.',
  ].filter(Boolean).join(' ')
}

export function shouldUsePlayerImageReference(prompt: string): boolean {
  const characterForward = /\b(player protagonist|protagonist|player character|traveler|returning player|face visible|close-up|medium shot|gripping|speaking|fighting|running|kneeling|holding)\b/i.test(prompt)
  const establishing = /\b(empty|environment-only|object-only|wide shot|wide view|panorama|panoramic|aerial|cityscape|landscape|establishing shot|overlook)\b/i.test(prompt)
  return characterForward && !establishing
}

export function upgradePendingSceneImagePrompts(save: StorySave, cartridge: StoryCartridge): StorySave {
  let changed = false
  const blocks = save.blocks.map((block, index) => {
    if (block.kind !== 'image' || block.id === 'image-0' || block.data?.status === 'ready') return block
    if (Number(block.data?.promptVersion ?? 0) >= SCENE_IMAGE_PROMPT_VERSION) return block
    let previousImage = -1
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      if (save.blocks[cursor]?.kind === 'image') { previousImage = cursor; break }
    }
    const parsed: ParsedScene = {
      blocks: save.blocks.slice(previousImage + 1, index).filter((candidate) => candidate.kind !== 'image'),
      commands: [],
      raw: '',
    }
    const historical = { ...save, location: block.text || save.location }
    changed = true
    return {
      ...block,
      data: {
        ...block.data,
        prompt: buildScenePrompt(cartridge, historical, parsed, 'cadence'),
        promptVersion: SCENE_IMAGE_PROMPT_VERSION,
        status: block.data?.status === 'generating' ? 'queued' : block.data?.status ?? 'queued',
      },
    }
  })
  return changed ? { ...save, blocks } : save
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
    return {
      prompt: buildScenePrompt(cartridge, next, parsed, 'cadence', proposal),
      source: 'ai',
      reason: 'ai-proposal',
    }
  }

  const director = cartridge.imageDirector
  if (!director) return {}
  const triggers = detectTriggers(previous, parsed)
  const guaranteed = firstTrigger(triggers, director.guaranteedTriggers)
  if (guaranteed) return { prompt: buildScenePrompt(cartridge, next, parsed, guaranteed), source: 'director', reason: guaranteed }

  const turnsSinceImage = next.scene - lastScheduledScene(previous)
  const soft = firstTrigger(triggers, director.softTriggers)
  if (soft && turnsSinceImage >= director.softCooldownTurns) {
    return { prompt: buildScenePrompt(cartridge, next, parsed, soft), source: 'director', reason: soft }
  }
  if (turnsSinceImage >= director.maxQuietTurns) {
    return { prompt: buildScenePrompt(cartridge, next, parsed, 'cadence'), source: 'director', reason: 'cadence' }
  }
  return {}
}
