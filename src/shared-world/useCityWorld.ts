import { useCallback, useEffect, useMemo, useState } from 'react'
import { readWorld } from './engine'
import { DEMO_TRAVELLERS } from './demo'
import { LocalSharedWorldGateway, RemoteSharedWorldGateway } from './gateway'
import { isInAigramNow, getTelegramId } from '../shared/runtime/bridge'
import { getGameApiBase } from '../shared/runtime/game-api-base'
import { usePlayerProfile } from '../story/usePlayerProfile'
import { useGrantInventory } from './useGrantInventory'
import type { CommitCode, RegionId, TraceKind, Traveller, WorldAction, WorldArchive, WorldView } from './types'

type Notice = { kind: 'success' | 'error' | 'info'; code: CommitCode | 'LOADED' | 'RESET' | 'REPORT_SAVED' }

function currentTravellerId() {
  try { return localStorage.getItem('city-of-tides-active-traveller') || DEMO_TRAVELLERS[0].id } catch { return DEMO_TRAVELLERS[0].id }
}

export function useCityWorld() {
  const profile = usePlayerProfile()
  const query = useMemo(() => new URLSearchParams(window.location.search), [])
  const labMode = query.get('lab') === '1'
  const localMode = query.get('local') === '1'
  const apiBase = query.get('api_base') || (localMode ? '' : getGameApiBase())
  const gateway = useMemo(() => apiBase ? new RemoteSharedWorldGateway(apiBase, labMode) : new LocalSharedWorldGateway(), [apiBase, labMode])
  const [archive, setArchive] = useState<WorldArchive | null>(null)
  const [view, setView] = useState<WorldView | null>(null)
  const [activeTravellerId, setActiveTravellerIdState] = useState(currentTravellerId)
  const [selectedRegionId, setSelectedRegionId] = useState<RegionId>('lighthouse')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const platformTraveller: Traveller = {
    id: getTelegramId()! || '__alteru_guest__',
    name: profile.name,
    initials: profile.name.slice(0, 2).toUpperCase(),
    avatarUrl: profile.avatarUrl,
  }
  const travellers = labMode || gateway.mode === 'local' ? DEMO_TRAVELLERS : [platformTraveller]
  const activeTraveller = labMode || gateway.mode === 'local'
    ? travellers.find((item) => item.id === activeTravellerId) || travellers[0]
    : platformTraveller
  const privateInventoryEnabled = gateway.mode === 'remote' && !labMode && isInAigramNow() && Boolean(getTelegramId()!)
  const grantInventory = useGrantInventory(gateway, String(getTelegramId()! || ''), privateInventoryEnabled, view?.cursor ?? 0)

  const refresh = useCallback(async () => {
    const next = await gateway.load()
    setArchive(next.archive)
    setView(next.view)
    return next
  }, [gateway])

  useEffect(() => { refresh().then(() => setNotice({ kind: 'info', code: 'LOADED' })).catch(() => {}) }, [refresh])

  useEffect(() => {
    if (gateway.mode !== 'remote') return
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible' && !busy) refresh().catch(() => {}) }, 15_000)
    const onVisible = () => { if (document.visibilityState === 'visible') refresh().catch(() => {}) }
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [busy, gateway, refresh])

  const setActiveTravellerId = useCallback((id: string) => {
    setActiveTravellerIdState(id)
    try { localStorage.setItem('city-of-tides-active-traveller', id) } catch { /* ignore */ }
  }, [])

  const commit = useCallback(async (make: (base: Pick<WorldAction, 'actionId' | 'actorUserId' | 'expectedVersion' | 'createdAt'>) => WorldAction) => {
    if (!archive || busy) return null
    setBusy(true)
    const base = { actionId: crypto.randomUUID(), actorUserId: activeTraveller.id, actorName: activeTraveller.name, actorAvatarUrl: activeTraveller.avatarUrl, expectedVersion: archive.version, createdAt: Date.now() }
    try {
      const result = await gateway.commit(make(base))
      setArchive(result.archive)
      setView(readWorld(result.archive))
      setNotice({ kind: result.duplicate ? 'info' : 'success', code: result.code })
      return result
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: string }).code) as CommitCode : 'INVALID_ACTION'
      setNotice({ kind: 'error', code })
      return null
    } finally {
      setBusy(false)
    }
  }, [activeTraveller, archive, busy, gateway])

  const createTrace = useCallback((regionId: RegionId, kind: TraceKind, message: string, replyToId?: string) => commit((base) => ({
    ...base, type: 'create_trace', payload: { regionId, kind, message, ...(replyToId ? { replyToId } : {}) },
  })), [commit])

  const reinforce = useCallback((traceId: string) => commit((base) => ({ ...base, type: 'reinforce_trace', payload: { traceId } })), [commit])
  const claimAid = useCallback((traceId: string) => commit((base) => ({ ...base, type: 'claim_aid', payload: { traceId } })), [commit])
  const contribute = useCallback((regionId: RegionId, message: string) => commit((base) => ({ ...base, type: 'contribute_project', payload: { regionId, amount: 25, message } })), [commit])
  const resolveSeason = useCallback(() => commit((base) => ({ ...base, type: 'resolve_season', payload: { force: true } })), [commit])
  const reportTrace = useCallback(async (traceId: string) => {
    if (gateway.mode !== 'remote' || !isInAigramNow() || !getTelegramId()!) {
      setNotice({ kind: 'error', code: 'AUTH_REQUIRED' })
      return false
    }
    try {
      await gateway.reportTrace(traceId, String(getTelegramId()!))
      await refresh()
      setNotice({ kind: 'success', code: 'REPORT_SAVED' })
      return true
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: string }).code) as CommitCode : 'INVALID_ACTION'
      setNotice({ kind: 'error', code })
      return false
    }
  }, [gateway, refresh])

  const reset = useCallback(async () => {
    const next = await gateway.reset()
    setArchive(next)
    setView(readWorld(next))
    setActiveTravellerId(DEMO_TRAVELLERS[0].id)
    setSelectedRegionId('lighthouse')
    setNotice({ kind: 'info', code: 'RESET' })
  }, [gateway, setActiveTravellerId])

  const simulateConflict = useCallback(async () => {
    if (!archive) return
    const stale: WorldAction = {
      actionId: crypto.randomUUID(), actorUserId: activeTraveller.id, expectedVersion: Math.max(0, archive.version - 1), createdAt: Date.now(),
      type: 'create_trace', payload: { regionId: selectedRegionId, kind: 'message', message: 'stale probe' },
    }
    try { await gateway.commit(stale) } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: string }).code) as CommitCode : 'INVALID_ACTION'
      setNotice({ kind: 'error', code })
    }
  }, [activeTraveller.id, archive, gateway, selectedRegionId])

  return {
    archive, view, busy, notice, setNotice, activeTraveller, travellers, gatewayMode: gateway.mode,
    privateInventoryEnabled, playerInventory: grantInventory.inventory, grantSyncStatus: grantInventory.status, refreshGrants: grantInventory.refresh,
    playerSaveLoaded: grantInventory.playerSaveLoaded, hasVisited: grantInventory.hasVisited, markVisited: grantInventory.markVisited,
    activeTravellerId, setActiveTravellerId, selectedRegionId, setSelectedRegionId,
    createTrace, reinforce, claimAid, contribute, resolveSeason, reportTrace, reset, refresh, simulateConflict,
  }
}
