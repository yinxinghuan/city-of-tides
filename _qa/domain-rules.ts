import assert from 'node:assert/strict'
import { cityOfTides } from '../src/story/cartridges/cityOfTides'
import { resolveDomainAction } from '../src/story/engine/domainRules'
import { applyParsedScene, createInitialSave } from '../src/story/engine/reducer'
import { parseStoryProtocol } from '../src/story/engine/protocol'

const actions = cityOfTides.opening.choices.map((choice) => choice.label)
for (const [index, action] of actions.entries()) {
  const save = createInitialSave(cityOfTides)
  const resolution = resolveDomainAction(save, cityOfTides, action)
  assert.equal(resolution?.kind, 'accepted')
  const hostile = parseStoryProtocol('[widget: city-bond, value: 99]\n[choices: "wrong one"|"wrong two"|"wrong three"]', 'zh')
  const next = applyParsedScene(save, hostile, cityOfTides, action, undefined, undefined, undefined, resolution)
  assert.equal(next.facts['opening-path'], ['old-road', 'rescue', 'overview'][index])
  assert.equal(next.choices.length, 3)
  assert.notEqual(next.choices[0]?.label, 'wrong one')
  assert.equal(resolveDomainAction(next, cityOfTides, action)?.kind, 'rejected')
}
const rescue = resolveDomainAction(createInitialSave(cityOfTides), cityOfTides, actions[1])
const rescued = applyParsedScene(createInitialSave(cityOfTides), parseStoryProtocol(rescue!.text, 'zh'), cityOfTides, actions[1], undefined, undefined, undefined, rescue)
assert.equal(rescued.characters.some((character) => character.id === 'nilo'), true)
console.log(JSON.stringify({ ok: true, branches: 3, localAuthority: true, introduced: 'nilo' }))

