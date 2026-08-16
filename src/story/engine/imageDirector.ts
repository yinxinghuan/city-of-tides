import { SCENE_IMAGE_PROMPT_VERSION, type ParsedScene, type SceneImagePerspective, type SceneImageSubject, type SceneImageTrigger, type StoryCartridge, type StorySave } from '../types'

export interface SceneImageDecision {
  prompt?: string
  source?: 'ai' | 'director'
  reason?: 'ai-proposal' | SceneImageTrigger | 'cadence'
  playerVisible?: boolean
  perspective?: SceneImagePerspective
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

function playerIsVisible(parsed: ParsedScene, proposal?: string, subject?: SceneImageSubject): boolean {
  if (subject === 'player') return true
  if (subject === 'environment' || subject === 'others') return false
  const shot = `${proposal ?? ''} ${visibleBeat(parsed)}`
  if (/\b(no people|nobody|unoccupied|environment-only|object-only)\b|无人|空镜|纯环境|物品特写/i.test(shot)) return false
  return /\b(player protagonist|protagonist|player character|returning player|the player|traveler|wayfarer|adventurer|you)\b|玩家|主角|旅人|旅行者|冒险者|你/i.test(shot)
}

function directedPerspective(next: StorySave, parsed: ParsedScene, cartridge: StoryCartridge, reason: SceneImageTrigger | 'cadence', proposal: string | undefined, playerVisible: boolean): SceneImagePerspective {
  if (playerVisible) return 'observer'
  const shot = proposal ?? ''
  if (/\b(first[- ]person|player[- ]eye|point[- ]of[- ]view|POV)\b|第一人称|主角视角|玩家视角/i.test(shot)) return 'first-person'
  if (/\b(third[- ]person|over[- ]the[- ]shoulder|wide establishing|full[- ]body protagonist)\b|第三人称|肩后|全身主角|环境建立镜头/i.test(shot)) return 'observer'
  const policy = cartridge.imageDirector?.perspective
  if (reason === 'new-location') return policy?.newLocation ?? 'observer'
  if (parsed.blocks.some((block) => block.kind === 'dialogue' && block.text.replace(/\s+/g, '').length >= 12)) return policy?.importantDialogue ?? 'observer'
  if (!policy || policy.ordinary === 'observer') return 'observer'
  const roll = Math.max(0, Math.floor(next.scene)) % 4
  return policy.ordinary === 'balanced' ? (roll % 2 === 0 ? 'first-person' : 'observer') : (roll === 0 ? 'observer' : 'first-person')
}

function buildScenePrompt(
  cartridge: StoryCartridge,
  next: StorySave,
  parsed: ParsedScene,
  reason: SceneImageTrigger | 'cadence',
  aiProposal?: string,
  playerVisible = false,
  perspective: SceneImagePerspective = 'observer',
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
    perspective === 'first-person' ? "FIRST-PERSON PLAYER-EYE VIEW. The camera is exactly the protagonist's eyes. Keep the protagonist's face, head, back, shoulders, silhouette, reflection and entire body out of frame; never use over-the-shoulder staging or invent hands unless the visible story establishes them." : 'OBSERVER / THIRD-PERSON VIEW. Use an external cinematic camera and preserve clear spatial relationships.',
    playerVisible ? 'The player protagonist is visibly present in this frame and must be the same person performing the dominant player action. Do not assign that action to a substitute character.' : '',
    'Compose one readable moment with one dominant action and at most two focal subjects. Choose a camera position, scale, lighting pattern and silhouette that differ from earlier images.',
    'Ignore all cover art and opening-scene imagery. Derive the depicted location, action, subjects, props and weather only from the primary shot brief and latest visible story beat.',
    'Show only people, objects, places and consequences established in the latest visible story. No montage, split screen, flash-forward, readable text, letters, logo, border, poster layout or UI.',
  ].filter(Boolean).join(' ')
}

export function shouldUsePlayerImageReference(prompt: string): boolean {
  const explicitlyEmpty = /\b(no people|nobody|unoccupied|environment-only|object-only)\b|无人|空镜|纯环境|物品特写/i.test(prompt)
  const firstPerson = /\b(first[- ]person|player[- ]eye|point[- ]of[- ]view|POV)\b|第一人称|主角视角|玩家视角/i.test(prompt)
  const playerVisible = /\b(player protagonist|protagonist|player character|returning player|the player|traveler|wayfarer|adventurer|you)\b|玩家|主角|旅人|旅行者|冒险者/i.test(prompt)
  return playerVisible && !explicitlyEmpty && !firstPerson
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
    const visible = playerIsVisible(parsed)
    const perspective = directedPerspective(historical, parsed, cartridge, 'cadence', undefined, visible)
    changed = true
    return {
      ...block,
      data: {
        ...block.data,
        prompt: buildScenePrompt(cartridge, historical, parsed, 'cadence', undefined, visible, perspective),
        promptVersion: SCENE_IMAGE_PROMPT_VERSION,
        playerVisible: visible ? 'true' : 'false',
        perspective,
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
  imageSubject?: SceneImageSubject,
): SceneImageDecision {
  const proposal = aiPrompt?.trim()
  if (proposal) {
    const visible = playerIsVisible(parsed, proposal, imageSubject)
    const perspective = directedPerspective(next, parsed, cartridge, 'cadence', proposal, visible)
    return {
      prompt: buildScenePrompt(cartridge, next, parsed, 'cadence', proposal, visible, perspective),
      source: 'ai',
      reason: 'ai-proposal',
      playerVisible: visible,
      perspective,
    }
  }

  const director = cartridge.imageDirector
  if (!director) return {}
  const visible = playerIsVisible(parsed, undefined, imageSubject)
  const triggers = detectTriggers(previous, parsed)
  const guaranteed = firstTrigger(triggers, director.guaranteedTriggers)
  if (guaranteed) { const perspective = directedPerspective(next, parsed, cartridge, guaranteed, undefined, visible); return { prompt: buildScenePrompt(cartridge, next, parsed, guaranteed, undefined, visible, perspective), source: 'director', reason: guaranteed, playerVisible: visible, perspective } }

  const turnsSinceImage = next.scene - lastScheduledScene(previous)
  const soft = firstTrigger(triggers, director.softTriggers)
  if (soft && turnsSinceImage >= director.softCooldownTurns) {
    const perspective = directedPerspective(next, parsed, cartridge, soft, undefined, visible)
    return { prompt: buildScenePrompt(cartridge, next, parsed, soft, undefined, visible, perspective), source: 'director', reason: soft, playerVisible: visible, perspective }
  }
  if (turnsSinceImage >= director.maxQuietTurns) {
    const perspective = directedPerspective(next, parsed, cartridge, 'cadence', undefined, visible)
    return { prompt: buildScenePrompt(cartridge, next, parsed, 'cadence', undefined, visible, perspective), source: 'director', reason: 'cadence', playerVisible: visible, perspective }
  }
  return {}
}
