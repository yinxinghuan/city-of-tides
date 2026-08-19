import assert from 'node:assert/strict'
import { cityOfTides } from '../src/story/cartridges/cityOfTides'
import { createAuthorityShadowSample } from '../src/story/engine/authorityShadow'
import { createInitialSave } from '../src/story/engine/reducer'
import { createSharedAuthorityShadowSample } from '../src/shared-world/authorityShadow'
const save = createInitialSave(cityOfTides); const visible = JSON.stringify(save.choices); const sample = createAuthorityShadowSample(save, cityOfTides)
assert.equal(JSON.stringify(save.choices), visible); assert.equal(sample.choices.length, save.choices.length); assert.equal(sample.emptyTray, false); assert.ok(sample.choices.every((choice) => ['accepted', 'rejected', 'open'].includes(choice.status))); assert.equal(createAuthorityShadowSample({ ...save, entered: true, choices: [], sessionEnded: false }, cityOfTides).emptyTray, true)
const shared = createSharedAuthorityShadowSample('market', ['aid', 'message', 'repair'], false)
assert.deepEqual(shared.actions.map((action) => action.status), ['accepted', 'accepted', 'accepted'])
assert.equal(shared.actions.some((action) => action.disabled), false)
console.log('city-of-tides authority shadow is observational: ok')
