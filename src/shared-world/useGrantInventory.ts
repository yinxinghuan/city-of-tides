import { useCallback, useEffect, useRef, useState } from 'react'
import { useGameSave } from '../shared/save/useGameSave'
import { callAigramAPI, isInAigram, telegramId, type AigramResponse } from '../shared/runtime/bridge'
import { getGameUuid } from '../shared/runtime/game-id'
import type { SharedWorldGateway } from './gateway'
import { applyPendingGrants, emptyPlayerSave, includesGrantReceipts, normalizePlayerSave } from './playerInventory'
import type { CityPlayerSave } from './types'

interface SaveRow { user_id: string; resource_data: string }
export type GrantSyncStatus = 'unavailable' | 'idle' | 'syncing' | 'saved' | 'pending' | 'error'

const wait = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))

async function cloudContains(receiptIds: string[]): Promise<boolean> {
  const sessionId = getGameUuid()
  if (!isInAigram || !sessionId || !telegramId) return false
  try {
    const response = await callAigramAPI<AigramResponse<SaveRow[]>>(`/note/aigram/ai/game/get/data/list?session_id=${encodeURIComponent(sessionId)}`)
    const mine = (Array.isArray(response?.data) ? response.data : []).find((row) => String(row.user_id) === String(telegramId))
    if (!mine?.resource_data) return false
    return includesGrantReceipts(JSON.parse(mine.resource_data), receiptIds)
  } catch {
    return false
  }
}

export function useGrantInventory(gateway: SharedWorldGateway, userId: string, enabled: boolean, worldCursor: number) {
  const { savedData, persist } = useGameSave<CityPlayerSave>('city-of-tides-player')
  const [mirror, setMirror] = useState<CityPlayerSave | undefined>(undefined)
  const [status, setStatus] = useState<GrantSyncStatus>(enabled ? 'idle' : 'unavailable')
  const syncing = useRef(false)
  const pendingVisit = useRef(false)

  useEffect(() => {
    if (mirror === undefined && savedData !== undefined) setMirror(normalizePlayerSave(savedData ?? emptyPlayerSave()))
  }, [mirror, savedData])

  useEffect(() => { if (!enabled) setStatus('unavailable') }, [enabled])

  const markVisited = useCallback(() => {
    if (mirror === undefined) { pendingVisit.current = true; return }
    if (mirror.hasEntered) return
    const next = { ...mirror, hasEntered: true }
    setMirror(next)
    persist(next)
  }, [mirror, persist])

  useEffect(() => {
    if (mirror === undefined || !pendingVisit.current) return
    pendingVisit.current = false
    if (mirror.hasEntered) return
    const next = { ...mirror, hasEntered: true }
    setMirror(next)
    persist(next)
  }, [mirror, persist])

  const reconcile = useCallback(async () => {
    if (!enabled || mirror === undefined || syncing.current || !telegramId || String(telegramId) !== String(userId)) return
    syncing.current = true
    try {
      const receipts = await gateway.listPendingGrants(userId)
      if (receipts.length === 0) {
        setStatus((current) => current === 'saved' ? current : 'idle')
        return
      }

      const next = applyPendingGrants(mirror, receipts)
      if (next.appliedGrantReceiptIds.length !== mirror.appliedGrantReceiptIds.length) {
        setMirror(next)
        persist(next)
      }
      setStatus('syncing')

      const receiptIds = receipts.map((receipt) => receipt.receiptId)
      let verified = await cloudContains(receiptIds)
      for (const delay of [1_400, 2_500, 5_000]) {
        if (verified) break
        await wait(delay)
        verified = await cloudContains(receiptIds)
      }
      if (!verified) {
        setStatus('pending')
        return
      }

      await Promise.all(receiptIds.map((receiptId) => gateway.acknowledgeGrant(receiptId, userId)))
      setStatus('saved')
    } catch {
      setStatus('error')
    } finally {
      syncing.current = false
    }
  }, [enabled, gateway, mirror, persist, userId])

  useEffect(() => { reconcile().catch(() => {}) }, [reconcile, worldCursor])

  return {
    inventory: enabled && mirror ? mirror.inventory : [],
    status,
    refresh: reconcile,
    playerSaveLoaded: mirror !== undefined,
    hasVisited: Boolean(mirror?.hasEntered || mirror?._lastActive),
    markVisited,
  }
}
