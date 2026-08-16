import assert from 'node:assert/strict'
import { cityOfTides, cityOfTidesEn } from '../src/story/cartridges/cityOfTides'
import { chooseSceneImage } from '../src/story/engine/imageDirector'
import { createInitialSave } from '../src/story/engine/reducer'
import type { ParsedScene, StoryCartridge } from '../src/story/types'

function narration(text = 'A concrete harbor consequence is visible now.'): ParsedScene {
  return { blocks: [{ id: 'beat', kind: 'narration', text }], commands: [], raw: text }
}

function audit(cartridge: StoryCartridge) {
  const initial = createInitialSave(cartridge)
  const counts = { first: 0, observer: 0 }
  for (let offset = 0; offset < 20; offset += 1) {
    const scene = offset + 4
    const decision = chooseSceneImage(initial, { ...initial, scene }, narration(), cartridge, 'a current harbor event with one NPC and no protagonist visible', 'others')
    if (decision.perspective === 'first-person') counts.first += 1
    if (decision.perspective === 'observer') counts.observer += 1
  }
  assert.equal(counts.first, 10)
  assert.equal(counts.observer, 10)

  const dialogue: ParsedScene = { blocks: [{ id: 'line', kind: 'dialogue', speaker: 'Nilo', text: 'The rising tide will close this stair unless we move now.' }], commands: [], raw: '' }
  const dialogueShot = chooseSceneImage(initial, { ...initial, scene: 24 }, dialogue, cartridge, undefined, 'others')
  assert.equal(dialogueShot.perspective, 'first-person')
  assert.match(dialogueShot.prompt ?? '', /FIRST-PERSON PLAYER-EYE VIEW/)
  assert.equal(dialogueShot.playerVisible, false)

  const arrival: ParsedScene = { blocks: [{ id: 'arrival', kind: 'narration', text: 'The Rain Market opens ahead.' }], commands: [{ type: 'map_update', location: 'Rain Market' }], raw: '' }
  const arrivalShot = chooseSceneImage(initial, { ...initial, scene: 24, location: 'Rain Market' }, arrival, cartridge, undefined, 'environment')
  assert.equal(arrivalShot.perspective, 'observer')

  const playerShot = chooseSceneImage(initial, { ...initial, scene: 25 }, narration('The protagonist raises the Foldtide Sail.'), cartridge, 'the player protagonist raises the Foldtide Sail', 'player')
  assert.equal(playerShot.perspective, 'observer')
  assert.equal(playerShot.playerVisible, true)
}

audit(cityOfTides)
audit(cityOfTidesEn)
console.log(JSON.stringify({ ok: true, locales: 2, ordinaryImagesPerLocale: 20, split: '10/10' }))

