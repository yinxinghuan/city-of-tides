import type { AdapterResult, StoryAdapter } from '../types'
import { t } from '../i18n'
import { extractSceneImagePrompt } from '../engine/protocol'
import { buildWorldContext, partyContinuityContract } from '../engine/worldContext'

const endpoint = import.meta.env.VITE_STORY_API_ORIGIN || 'https://uu545921-zfkm-aec62664.westb.seetacloud.com:8443'

function decodeEvent(chunk: string): { event?: string; data?: unknown } | null {
  const lines = chunk.split('\n')
  const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim()
  const raw = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n')
  if (!raw) return null
  try { return { event, data: JSON.parse(raw) } } catch { return { event, data: raw } }
}

export const remoteAdapter: StoryAdapter = {
  id: 'remote',
  async send(action, context, onProgress): Promise<AdapterResult> {
    const chatId = context.save.remoteChatId || new URLSearchParams(window.location.search).get('chat_id')
    if (!chatId) throw new Error(t(context.locale, 'remoteMissing'))
    const sceneImageDirection = context.cartridge.sceneImageDirection ?? `${context.cartridge.theme.material} story-world editorial illustration`
    const sceneImageAvoid = context.cartridge.sceneImageAvoid?.trim()
    const imageFreshness = `Make it a fresh shot of the CURRENT visible event: current location first, then one dominant action, visible subjects, and a concrete camera scale or angle. Use at most two focal subjects and no montage. Never carry over the cover/opening composition, landmarks, foreground props, weather, vehicle, crossroads, room or skyline unless the current prose explicitly contains them.${sceneImageAvoid ? ` Opening residue to avoid unless explicitly present now: ${sceneImageAvoid}.` : ''}`
    const languageInstruction = context.locale === 'en'
      ? `\n\n[LANGUAGE AND FORMAT: Reply in English. Keep every protocol command tag and its syntax intact. Unless this is a genuine chapter checkpoint, end with exactly three actions in this exact machine-readable form: [choices: "Action one"|"Action two"|"Action three"]. Button actions must match the decisions described in the prose. For a visually distinctive new place, discovery, relationship turn, major result, or checkpoint, propose one English scene prompt using [image_prompt: "cinematic visible scene, no text, no UI, 4:3"]. Depict only visible established facts and follow this art direction: ${sceneImageDirection}. ${imageFreshness} Skip routine conversation.]`
      : `\n\n[语言与格式要求：请用简体中文回复，并保持所有协议命令标签及语法不变。除非这是真正的章节节点，否则结尾必须用这一机器可读格式给出恰好三个行动：[choices: "行动一"|"行动二"|"行动三"]。按钮行动必须与正文描述的决定一致。遇到具有明显视觉价值的新地点、发现、关系转折、重大结果或阶段节点时，用 [image_prompt: "English cinematic visible scene, no text, no UI, 4:3"] 提议一张场景图；只画正文已经公开的事实，并遵循这一画风：${sceneImageDirection}。${imageFreshness} 普通对话不要提议。]`
    const response = await fetch(`${endpoint}/api/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        userMessage: `AUTHORITATIVE_WORLD_STATE_JSON:\n${JSON.stringify(buildWorldContext(context))}\n\n${partyContinuityContract}\n\nPLAYER_ACTION:\n${action}${languageInstruction}`,
        streaming: false,
      }),
    })
    if (!response.ok || !response.body) throw new Error(t(context.locale, 'remoteUnavailableError', { n: response.status }))
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let finalContent = ''
    while (true) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done })
      const chunks = buffer.split(/\n\n+/)
      buffer = chunks.pop() ?? ''
      chunks.forEach((chunk) => {
        const message = decodeEvent(chunk)
        if (!message || message.event === 'thinking') return
        const data = message.data as Record<string, unknown> | string
        if (message.event === 'progress') onProgress?.({ label: typeof data === 'string' ? data : String(data?.message ?? t(context.locale, 'worldResponding')) })
        if (message.event === 'message_saved' && typeof data === 'object') {
          const nested = data.message as Record<string, unknown> | undefined
          finalContent = String(data.content ?? nested?.content ?? '')
        }
      })
      if (done) break
    }
    if (!finalContent) throw new Error(t(context.locale, 'remoteEmpty'))
    return { content: finalContent, imagePrompt: extractSceneImagePrompt(finalContent) }
  },
}
