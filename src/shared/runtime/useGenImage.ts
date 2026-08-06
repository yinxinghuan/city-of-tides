import { useCallback, useState } from 'react'

const endpoint = 'https://chat.aiwaves.tech/aigram/api/gen-image'

export function useGenImage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const generate = useCallback(async ({ prompt, ref_url }: { prompt: string; ref_url?: string }) => {
    setLoading(true); setError(null)
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, ...(ref_url ? { ref_url } : {}) }) })
      if (!response.ok) throw new Error(`image HTTP ${response.status}`)
      const body = await response.json() as { url?: string }
      if (!body.url) throw new Error('image response had no url')
      return body.url
    } catch (cause) {
      const next = cause instanceof Error ? cause : new Error(String(cause)); setError(next); throw next
    } finally { setLoading(false) }
  }, [])
  return { generate, loading, error }
}
