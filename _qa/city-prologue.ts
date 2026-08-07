import { cityOfTides, cityOfTidesEn } from '../src/story/cartridges/cityOfTides'
import { applyParsedScene, createInitialSave } from '../src/story/engine/reducer'
import { parseStoryProtocol } from '../src/story/engine/protocol'
import { buildWorldContext } from '../src/story/engine/worldContext'

function ok(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
function equal(actual: unknown, expected: unknown, message: string) { if (actual !== expected) throw new Error(`${message}: ${String(actual)} !== ${String(expected)}`) }

for (const cartridge of [cityOfTides, cityOfTidesEn]) {
  let save = createInitialSave(cartridge)
  equal(cartridge.director?.mode, 'open-world', `${cartridge.locale}: open-world mode`)
  equal(cartridge.opening.choices.length, 3, `${cartridge.locale}: three opening choices`)
  equal(cartridge.statDefinitions.length, 3, `${cartridge.locale}: three visible stats`)
  equal(save.location, cartridge.opening.location, `${cartridge.locale}: opening location`)
  ok(save.inventory.every((item) => item.detail && item.effect && item.lore && item.metrics?.length), `${cartridge.locale}: inventory explains use, limit and provenance`)

  const route = [1, 3, 4, 5, 6]
  for (const index of route) {
    const turn = cartridge.demoTurns[index]
    const parsed = parseStoryProtocol(turn.content, cartridge.locale)
    equal(parsed.commands.find((command) => command.type === 'choices')?.type, 'choices', `${cartridge.locale}: turn ${index} offers structured choices`)
    save = applyParsedScene(save, parsed, cartridge, `QA action ${index}`, turn.imagePrompt)
    equal(save.choices.length, 3, `${cartridge.locale}: turn ${index} has three matching actions`)
  }

  const nilo = save.characters.find((character) => character.name === (cartridge.locale === 'zh' ? '尼洛' : 'Nilo'))
  ok(nilo, `${cartridge.locale}: Nilo is persisted`)
  equal(nilo.status, 'companion', `${cartridge.locale}: Nilo remains a companion`)
  ok(save.partyMemberIds.includes(nilo.id), `${cartridge.locale}: Nilo remains in authoritative party`)
  equal(save.location, cartridge.locale === 'zh' ? '潮钟瞭望台' : 'Tidewatch Overlook', `${cartridge.locale}: prologue reaches overlook`)
  equal(save.sessionEnded, true, `${cartridge.locale}: prologue becomes a resumable checkpoint`)
  ok(save.objective.includes(cartridge.locale === 'zh' ? '选择' : 'Choose'), `${cartridge.locale}: objective opens the city`)

  const context = buildWorldContext({ cartridge, save, actionId: cartridge.locale === 'zh' ? '我不选建议，先检查瞭望台下面的水路' : 'I reject the suggestions and inspect the waterway below the overlook', locale: cartridge.locale })
  equal(context.current.activeParty.length, 1, `${cartridge.locale}: free action context retains party`)
  ok(context.current.activeParty[0].name === nilo.name, `${cartridge.locale}: Nilo is sent to AI after checkpoint`)
}

console.log('city prologue ok · bilingual state · companion continuity · checkpoint freedom')
