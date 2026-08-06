import { useEffect, useMemo, useState } from 'react'
import { callAigramAPI, isInAigram, telegramId, type AigramResponse } from '../shared/runtime/bridge'

interface ProfileData { id?: string | number; user_id?: string | number; name?: string; user_name?: string; head_url?: string }

export interface PlayerProfile {
  id?: string
  name: string
  avatarUrl: string
  imageRefUrl?: string
  loaded: boolean
  source: 'debug' | 'aigram' | 'default'
}

function publicHttpsUrl(value: string): string | undefined {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : undefined } catch { return undefined }
}

export function usePlayerProfile(): PlayerProfile {
  const query = useMemo(() => new URLSearchParams(window.location.search), [])
  const debugAvatar = query.get('avatar_url')?.trim() || ''
  const debugName = query.get('user_name')?.trim() || ''
  const fallbackAvatar = new URL('./alteru-default-avatar.jpg', document.baseURI).href
  const [profile, setProfile] = useState<PlayerProfile>(() => ({
    id: telegramId || undefined,
    name: debugName || 'AlterU',
    avatarUrl: debugAvatar || fallbackAvatar,
    imageRefUrl: publicHttpsUrl(debugAvatar),
    loaded: !isInAigram,
    source: debugAvatar || debugName ? 'debug' : 'default',
  }))

  useEffect(() => {
    if (!isInAigram || !telegramId) return
    let cancelled = false
    ;(async () => {
      try {
        const response = await callAigramAPI<AigramResponse<ProfileData>>(
          `/note/telegram/user/get/info/by/telegram_id?telegram_id=${encodeURIComponent(telegramId)}`,
          'GET',
        )
        if (cancelled) return
        const data = response?.data
        const platformAvatar = data?.head_url?.trim() || ''
        const chosenAvatar = debugAvatar || platformAvatar
        setProfile({
          id: String(data?.id ?? data?.user_id ?? telegramId ?? ''),
          name: debugName || data?.name?.trim() || data?.user_name?.trim() || 'AlterU',
          avatarUrl: chosenAvatar || fallbackAvatar,
          imageRefUrl: publicHttpsUrl(chosenAvatar),
          loaded: true,
          source: debugAvatar || debugName ? 'debug' : platformAvatar ? 'aigram' : 'default',
        })
      } catch {
        if (!cancelled) setProfile((current) => ({ ...current, loaded: true }))
      }
    })()
    return () => { cancelled = true }
  }, [debugAvatar, debugName, fallbackAvatar])

  return profile
}
