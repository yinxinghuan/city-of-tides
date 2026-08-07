import { listCartridges } from '../src/story/cartridges/index'
import { parseStoryProtocol } from '../src/story/engine/protocol'
import { applyParsedScene, createInitialSave } from '../src/story/engine/reducer'

function equal(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) throw new Error(`${message}: ${String(actual)} !== ${String(expected)}`)
}

const zh = listCartridges('zh')[0]
const initialZh = createInitialSave(zh)
const acquiredZh = applyParsedScene(initialZh, parseStoryProtocol('你打开木匣，获得了一枚潮纹铜钥匙。', 'zh'), zh, '打开木匣')
equal(acquiredZh.inventory.find((item) => item.label === '潮纹铜钥匙')?.count, 1, 'unambiguous Chinese acquisition enters inventory')
equal(acquiredZh.blocks.some((block) => block.kind === 'change' && block.text.includes('潮纹铜钥匙')), true, 'inferred acquisition has visible feedback')

const discoveredOnly = applyParsedScene(initialZh, parseStoryProtocol('你在石台上发现了一枚潮纹铜钥匙，但还没有拿走它。', 'zh'), zh, '观察石台')
equal(discoveredOnly.inventory.some((item) => item.label.includes('潮纹铜钥匙')), false, 'seeing an item does not transfer ownership')

const removedZh = applyParsedScene(acquiredZh, parseStoryProtocol('你把铜钥匙交给守门人。你交出了潮纹铜钥匙。', 'zh'), zh, '交出钥匙')
equal(removedZh.inventory.some((item) => item.label === '潮纹铜钥匙'), false, 'unambiguous Chinese loss leaves inventory')

const explicitZh = applyParsedScene(initialZh, parseStoryProtocol('你收下了一枚路标徽章。\n[inventory: action="add" item="路标徽章" count="1"]', 'zh'), zh, '收下徽章')
equal(explicitZh.inventory.find((item) => item.label === '路标徽章')?.count, 1, 'explicit inventory command is not double-applied by prose inference')

const en = listCartridges('en')[0]
const initialEn = createInitialSave(en)
const acquiredEn = applyParsedScene(initialEn, parseStoryProtocol('You picked up a brass trail token.', 'en'), en, 'Pick up the token')
equal(acquiredEn.inventory.find((item) => item.label === 'brass trail token')?.count, 1, 'unambiguous English acquisition enters inventory')

console.log('state integrity ok · narrated acquisition persisted · discovery excluded · removal persisted · explicit command deduplicated')
