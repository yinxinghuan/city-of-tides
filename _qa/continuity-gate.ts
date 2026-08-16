import { strict as assert } from 'node:assert'
import { cityOfTides as cartridge } from '../src/story/cartridges/cityOfTides'
import { applyParsedScene, createInitialSave } from '../src/story/engine/reducer'
import { parseStoryProtocol } from '../src/story/engine/protocol'

const initial = createInitialSave(cartridge)
const destination = cartridge.initialMap.find((node) => !node.current)?.label ?? '测试新地点'
const parsed = parseStoryProtocol(`你把眼前已经发生的事处理完，准备离开。
[map_update: new_location="${destination}" connected_to="${initial.location}"]
[situation: "旧路已结束，新地点尚未摸清"]
[choices: "给火星总督送量子电报"|"追赶突然出现的银河快递员"|"喂养从未出现的像素独角兽"]`, cartridge.locale)
const next = applyParsedScene(initial, parsed, cartridge, '结束当前行动')

const transitionIndex = next.blocks.findIndex((block) => block.id === 'transition-1')
const visibleResultIndex = next.blocks.findIndex((block) => block.text.includes('眼前已经发生的事'))
assert.ok(transitionIndex >= 0, 'location change must create a visible transition anchor')
assert.ok(transitionIndex < visibleResultIndex, 'transition anchor must appear before destination prose')
assert.ok(next.blocks[transitionIndex].text.includes(cartridge.transitionAnchor ?? ''), 'transition must name the cartridge anchor')
assert.ok(next.choices.length >= 1, 'the scene remains playable after rejecting bad choices without padding to a fixed count')
assert.ok(next.choices.every((choice) => !/火星总督|银河快递员|像素独角兽/.test(choice.label)), 'unintroduced choice nouns must be rejected')
assert.equal(next.decisionContext, '旧路已结束，新地点尚未摸清', 'decision context must be an independent authored premise')

const partiallyGrounded = parseStoryProtocol(`尼洛正在返乡渡船旁固定缆绳，回潮已经逼近甲板。
[choices: "帮尼洛固定返乡渡船的缆绳"|"给火星总督送量子电报"|"追赶从未出现的银河快递员"]`, cartridge.locale)
const partialNext = applyParsedScene(initial, partiallyGrounded, cartridge, '查看甲板')
assert.deepEqual(partialNext.choices.map((choice) => choice.label), ['帮尼洛固定返乡渡船的缆绳'], 'one grounded choice survives without padding or unrelated recovery')

console.log(JSON.stringify({ game: cartridge.id, destination, transition: next.blocks[transitionIndex].text, choices: next.choices, partialChoices: partialNext.choices, decisionContext: next.decisionContext }, null, 2))
