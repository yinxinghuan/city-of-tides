import { listCartridges } from '../src/story/cartridges/index'
import { applyParsedScene, createInitialSave, normalizeCharacterState } from '../src/story/engine/reducer'
import { parseStoryProtocol } from '../src/story/engine/protocol'
import { buildWorldContext } from '../src/story/engine/worldContext'

function ok(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
function equal(actual: unknown, expected: unknown, message: string) { if (actual !== expected) throw new Error(`${message}: ${String(actual)} !== ${String(expected)}`) }

const cartridge = listCartridges('en')[0]
ok(cartridge, 'standalone cartridge is registered')
const initial = createInitialSave(cartridge)
equal(initial.version, 9, 'StorySave v9 is active')
const baselineParty = initial.partyMemberIds.length

const ordinaryTurn = applyParsedScene(initial, parseStoryProtocol(`The driver points to the loose wheel and asks whether you can stay to help.\n[choices: "Stay and help"|"Ask what broke"|"Keep walking"]`, 'en'), cartridge, 'Offer help')
equal(ordinaryTurn.decisionContext, '', 'ordinary visible prose does not create a duplicate context row')
const anchoredTurn = applyParsedScene(initial, parseStoryProtocol(`The driver blocks the road while the wheel leans off its axle.\n[situation: "The road stays blocked until the wheel is secured"]\n[choices: "Brace the axle"|"Find more rope"|"Ask the driver to move"]`, 'en'), cartridge, 'Inspect the wagon')
equal(anchoredTurn.decisionContext, 'The road stays blocked until the wheel is secured', 'an independent concise situation is preserved')
const copiedTurn = applyParsedScene(initial, parseStoryProtocol(`The road stays blocked until the wheel is secured.\n[situation: "The road stays blocked until the wheel is secured"]\n[choices: "Brace the axle"|"Find more rope"|"Ask the driver to move"]`, 'en'), cartridge, 'Inspect the wagon')
equal(copiedTurn.decisionContext, '', 'a copied prose sentence is rejected')
const statusDump = parseStoryProtocol(`The smith asks you to inspect the well.\n\n【当前状态更新】\n体力：75\n补给：6\n名望：10\n位置：灰瓦村方向 - 铁匠铺\n角色身份：帮工\n\n[widget: vitality, value: 75]\n[choices: "Inspect the well"|"Ask for rope"|"Rest first"]`, 'zh')
ok(statusDump.blocks.some((block) => block.text.includes('smith')), 'story prose remains visible')
ok(statusDump.blocks.every((block) => !/当前状态更新|体力：75|角色身份：帮工/.test(block.text)), 'narrated status report is removed from visible prose')
ok(statusDump.commands.some((command) => command.type === 'widget'), 'authoritative widget command remains')

const first = applyParsedScene(initial, parseStoryProtocol(`Ari becomes a recurring guide and joins the existing party.
[character_update: character="Ari" role="Guide" detail="Knows the old roads" vitality="81" stress="9" skills="Observe: 3|Track: 4"]
[party_change: character="Ari" change="add"]
[choices: "Continue together"|"Ask about the road"|"Make camp"]`, 'en'), cartridge, 'Recruit Ari')
const ari = first.characters.find((character) => character.name === 'Ari')
ok(ari, 'first dynamic companion is persisted')
equal(first.partyMemberIds.length, baselineParty + 1, 'first recruit merges with initial party')

const second = applyParsedScene(first, parseStoryProtocol(`Bea joins the travelers without replacing Ari.
[character_update: character="Bea" role="Healer" detail="Carries limited herbs"]
[party_change: character="Bea" change="add"]
[choices: "Share information"|"Travel together"|"Discuss supplies"]`, 'en'), cartridge, 'Recruit Bea')
equal(second.partyMemberIds.length, baselineParty + 2, 'second recruit merges instead of replacing')
ok(second.partyMemberIds.includes(ari.id), 'first recruit remains after second recruit')

let longState = second
for (let index = 0; index < 24; index += 1) {
  longState = applyParsedScene(longState, parseStoryProtocol(`The journey advances through event ${index + 1}.\n[choices: "Observe"|"Talk to companions"|"Check the route"]`, 'en'), cartridge, `Long turn ${index + 1}`)
}
const restored = JSON.parse(JSON.stringify(longState)) as typeof longState
equal(restored.partyMemberIds.length, baselineParty + 2, 'party survives JSON save/reload after a long history')
const context = buildWorldContext({ cartridge, save: restored, actionId: 'Meet strangers', locale: cartridge.locale })
ok(context.current.activeParty.some((character) => character.id === ari.id), 'AI context includes the complete active party')

const silentRemove = applyParsedScene(restored, parseStoryProtocol(`[party_change: character_id="${ari.id}" character="Ari" change="remove"]\n[choices: "Continue"|"Check the map"|"Rest"]`, 'en'), cartridge, 'Continue')
ok(silentRemove.partyMemberIds.includes(ari.id), 'a remove command without visible departure cannot silently erase a companion')

const migrated = normalizeCharacterState({
  blocks: [
    { id: 'effect-1-0', kind: 'event', text: 'Legacy One joined the party' },
    { id: 'effect-2-0', kind: 'event', text: 'Legacy Two joined the party' },
    { id: 'effect-3-0', kind: 'event', text: 'Legacy One left the party' },
  ],
  relationships: [],
}, cartridge)
ok(migrated.partyMemberIds.some((id) => migrated.characters.find((character) => character.id === id)?.name === 'Legacy Two'), 'v4 protocol events migrate into the party')
ok(!migrated.partyMemberIds.some((id) => migrated.characters.find((character) => character.id === id)?.name === 'Legacy One'), 'v4 explicit departure is respected')

const apostropheChoices = parseStoryProtocol(`[choices: "Play Mira's recording"|"Ask Nilo what's wrong"|"Climb to the upper deck"]`, 'en').commands.find((command) => command.type === 'choices')
ok(apostropheChoices?.type === 'choices', 'apostrophes inside double-quoted choices do not break the protocol')
equal(apostropheChoices.choices[0], "Play Mira's recording", 'the first apostrophe choice remains intact')
equal(parseStoryProtocol(`请做出选择\n[choices: "继续"|"停下"]`, 'zh').blocks.length, 0, 'redundant choice invitation is not visible prose')

console.log(`standalone protocol ok · game=${cartridge.id} · party=${restored.partyMemberIds.length}`)
