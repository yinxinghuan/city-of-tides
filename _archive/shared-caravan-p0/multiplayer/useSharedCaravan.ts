import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  STORAGE_KEY,
  classifyCustomAction,
  createInitialArchive,
  rebuildArchive,
  resolveRound,
  startNextRound,
  submitIntent,
  updateAbsencePolicy,
} from './engine'
import { MultiplayerEngineError, type AbsencePolicy, type IntentKind, type MultiplayerArchive } from './types'

function loadArchive() {
  try { const saved = localStorage.getItem(STORAGE_KEY); return saved ? rebuildArchive(JSON.parse(saved)) : createInitialArchive() } catch { return createInitialArchive() }
}

export function useSharedCaravan() {
  const [archive, setArchive] = useState<MultiplayerArchive>(loadArchive)
  const [selectedMemberId, setSelectedMemberId] = useState('host')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'info' | 'error'; code: string; details?: Record<string, unknown> } | null>(null)
  const selectedMember = archive.members.find((member) => member.id === selectedMemberId) || archive.members[0]
  const readyCount = Object.keys(archive.snapshot.intents).length

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(archive)) }, [archive])

  const commit = useCallback((next: MultiplayerArchive) => { setArchive(next); return next }, [])
  const handleError = useCallback((error: unknown) => {
    if (error instanceof MultiplayerEngineError) setNotice({ kind: 'error', code: error.code, details: error.details })
    else setNotice({ kind: 'error', code: 'UNKNOWN' })
  }, [])

  const submit = useCallback((kind: IntentKind, action: string) => {
    try {
      const previous = archive.snapshot.intents[selectedMember.id]
      const result = submitIntent(archive, {
        id: crypto.randomUUID(), round: archive.snapshot.round, expectedVersion: archive.snapshot.version,
        authorUserId: selectedMember.id, kind, action,
      })
      commit(result.archive)
      setNotice({ kind: 'info', code: previous ? 'REPLACED' : 'COMMITTED' })
      return result
    } catch (error) { handleError(error); return null }
  }, [archive, commit, handleError, selectedMember.id])

  const submitCustom = useCallback((action: string) => submit(classifyCustomAction(action), action), [submit])

  const resolve = useCallback((allowAbsence: boolean) => {
    if (busy) return null
    setBusy(true)
    try {
      const result = resolveRound(archive, {
        actionId: crypto.randomUUID(), expectedVersion: archive.snapshot.version,
        round: archive.snapshot.round, allowAbsence,
      })
      commit(result.archive)
      setNotice({ kind: 'info', code: 'RESOLVED', details: { version: result.archive.snapshot.version } })
      return result
    } catch (error) { handleError(error); return null }
    finally { window.setTimeout(() => setBusy(false), 240) }
  }, [archive, busy, commit, handleError])

  const nextRound = useCallback(() => {
    try {
      const result = startNextRound(archive, {
        actionId: crypto.randomUUID(), expectedVersion: archive.snapshot.version, round: archive.snapshot.round,
      })
      commit(result.archive)
      setNotice({ kind: 'info', code: 'NEXT', details: { round: result.archive.snapshot.round } })
      return result
    } catch (error) { handleError(error); return null }
  }, [archive, commit, handleError])

  const setPolicy = useCallback((memberId: string, policy: AbsencePolicy) => {
    try { commit(updateAbsencePolicy(archive, memberId, policy)) } catch (error) { handleError(error) }
  }, [archive, commit, handleError])

  const simulateStaleVersion = useCallback(() => {
    try {
      submitIntent(archive, {
        id: crypto.randomUUID(), round: archive.snapshot.round, expectedVersion: archive.snapshot.version - 1,
        authorUserId: selectedMember.id, kind: 'observe', action: 'stale-version-probe',
      })
    } catch (error) { handleError(error) }
  }, [archive, handleError, selectedMember.id])

  const replayCurrentAction = useCallback(() => {
    const intent = archive.snapshot.intents[selectedMember.id]
    if (!intent) { setNotice({ kind: 'error', code: 'NO_ACTION' }); return null }
    const result = submitIntent(archive, { ...intent, submittedAt: intent.submittedAt })
    commit(result.archive)
    setNotice({ kind: 'info', code: 'DUPLICATE' })
    return result
  }, [archive, commit, selectedMember.id])

  const reset = useCallback(() => {
    const next = createInitialArchive()
    localStorage.removeItem(STORAGE_KEY)
    setArchive(next)
    setSelectedMemberId('host')
    setNotice(null)
  }, [])

  const missingMembers = useMemo(() => archive.members.filter((member) => !archive.snapshot.intents[member.id]), [archive])

  return {
    archive, snapshot: archive.snapshot, selectedMember, selectedMemberId, setSelectedMemberId,
    readyCount, missingMembers, busy, notice, setNotice,
    submit, submitCustom, resolve, nextRound, setPolicy, simulateStaleVersion, replayCurrentAction, reset,
  }
}
