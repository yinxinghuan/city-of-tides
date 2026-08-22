import { useCallback, useState } from 'react'
import { getGameUuid } from './game-id'
import { createMediaRequestId, generateImageMedia, MediaServiceError } from './media'

const referenceMode = 'edit' as const

interface GenImageOptions {
  prompt: string
  ref_url?: string
  size?: { width: number; height: number }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

export function useGenImage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const generate = useCallback(async ({ prompt, ref_url, size = { width: 768, height: 576 } }: GenImageOptions) => {
    if (!prompt.trim()) throw new Error('story media: prompt is required')
    if (ref_url && !/^https:\/\//i.test(ref_url)) throw new Error('story media: reference must be public HTTPS')
    const sessionId = getGameUuid()
    if (!sessionId) throw new Error('story media: game UUID is unavailable')
    setLoading(true)
    setError(null)
    try {
      const request = {
        sessionId,
        requestId: createMediaRequestId(),
        mode: ref_url ? referenceMode : 'text' as const,
        prompt,
        referenceUrls: ref_url ? [ref_url] : [],
        size,
      }
      let task
      try {
        task = await generateImageMedia(request, { timeoutMs: 280_000 })
      } catch (cause) {
        if (cause instanceof MediaServiceError) {
          if (!cause.retryable) throw cause
          await delay(Math.max(1, cause.retryAfterSeconds ?? 1) * 1000)
          task = await generateImageMedia({
            ...request,
            requestId: cause.code === 'TIMEOUT' ? request.requestId : createMediaRequestId(),
          }, { timeoutMs: 280_000 })
        } else {
          task = await generateImageMedia(request, { timeoutMs: 280_000 })
        }
      }
      return task.media.url
    } catch (cause) {
      const next = cause instanceof Error ? cause : new Error(String(cause))
      setError(next)
      throw next
    } finally {
      setLoading(false)
    }
  }, [])

  return { generate, loading, error }
}
