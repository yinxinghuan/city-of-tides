import { resolveCartridge } from '../src/story/cartridges'
import { parseStoryProtocol } from '../src/story/engine/protocol'
import { applyParsedScene, createInitialSave } from '../src/story/engine/reducer'
import { shouldUsePlayerImageReference } from '../src/story/engine/imageDirector'
import { SCENE_IMAGE_PROMPT_VERSION } from '../src/story/types'

const cartridge = resolveCartridge(null, 'zh')
const scene = parseStoryProtocol('你已经进入测试用的地下档案室，并在倾斜的梁柱下打开一只铜边箱。\n[map_update: new_location="地下档案室" connected_to="开场地点"]\n[choices: "检查箱子"|"查看梁柱"|"离开"]', 'zh')
const save = applyParsedScene(createInitialSave(cartridge), scene, cartridge, '打开箱子', cartridge.opening.imagePrompt)
const image = [...save.blocks].reverse().find((block) => block.kind === 'image')
const prompt = String(image?.data?.prompt ?? '')
if (!prompt.includes('Current location hint: 地下档案室')) throw new Error('scene prompt lost the current location')
if (prompt.includes(cartridge.opening.imagePrompt)) throw new Error('opening prompt leaked into a later scene')
if (prompt.includes(cartridge.copy.title)) throw new Error('game title can bias the runtime composition')
if (Number(image?.data?.promptVersion) !== SCENE_IMAGE_PROMPT_VERSION) throw new Error('scene prompt version missing')
if (!shouldUsePlayerImageReference('medium shot of the player protagonist holding a lantern')) throw new Error('character shot should use the player reference')
if (shouldUsePlayerImageReference('wide establishing shot of an empty underground hall')) throw new Error('environment shot should be text-only')
console.log(`scene image v${SCENE_IMAGE_PROMPT_VERSION} ok · ${cartridge.id}`)
