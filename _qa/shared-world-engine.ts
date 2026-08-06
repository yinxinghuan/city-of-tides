import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { commitWorldAction, createWorld, DAY, readWorld, rebuildArchive, VISIBLE_TRACE_LIMIT } from '../src/shared-world/engine'
import { WorldRuleError, type RegionId, type TraceKind, type WorldAction, type WorldArchive } from '../src/shared-world/types'

Object.defineProperty(globalThis, 'crypto', { value: webcrypto })

const now = Date.UTC(2026, 7, 6, 12, 0, 0)
let archive = createWorld(now)
let actionCounter = 0

function base(actorUserId: string, createdAt = now) {
  actionCounter += 1
  return { actionId: `00000000-0000-4000-8000-${String(actionCounter).padStart(12, '0')}`, actorUserId, expectedVersion: archive.version, createdAt }
}

function commit(action: WorldAction) {
  const result = commitWorldAction(archive, action)
  archive = result.archive
  return result
}

function createTrace(actor: string, regionId: RegionId, kind: TraceKind, message: string, createdAt = now) {
  return commit({ ...base(actor, createdAt), type: 'create_trace', payload: { regionId, kind, message } })
}

const firstAction = { ...base('mira'), type: 'create_trace' as const, payload: { regionId: 'lighthouse' as const, kind: 'warning' as const, message: 'Third bell means high water.' } }
const first = commit(firstAction)
const firstTraceId = (first.committedEvents[0].payload as { traceId: string }).traceId
const versionAfterFirst = archive.version
const duplicate = commitWorldAction(archive, firstAction)
assert.equal(duplicate.duplicate, true)
assert.equal(duplicate.archive.version, versionAfterFirst)

assert.throws(() => commitWorldAction(archive, {
  actionId: crypto.randomUUID(), actorUserId: 'sana', expectedVersion: 1, createdAt: now,
  type: 'create_trace', payload: { regionId: 'lighthouse', kind: 'message', message: 'stale' },
}), (error) => error instanceof WorldRuleError && error.code === 'VERSION_CONFLICT')

commit({ ...base('sana'), type: 'reinforce_trace', payload: { traceId: firstTraceId } })
commit({ ...base('jon'), type: 'reinforce_trace', payload: { traceId: firstTraceId } })
commit({ ...base('iko'), type: 'reinforce_trace', payload: { traceId: firstTraceId } })
assert.equal(readWorld(archive, now + 80 * 60 * 60 * 1000).traces.find((trace) => trace.traceId === firstTraceId)?.anchoredForSeason, true)

const aid = createTrace('jon', 'market', 'aid', 'Three sealed lantern cells.')
const aidId = (aid.committedEvents[0].payload as { traceId: string }).traceId
for (const actor of ['mira', 'sana', 'iko']) commit({ ...base(actor), type: 'claim_aid', payload: { traceId: aidId } })
assert.equal(readWorld(archive, now).traces.find((trace) => trace.traceId === aidId)?.remainingCharges, 0)
assert.throws(() => commitWorldAction(archive, { ...base('nox'), type: 'claim_aid', payload: { traceId: aidId } }), (error) => error instanceof WorldRuleError && error.code === 'ITEM_UNAVAILABLE')

for (let i = 0; i < 9; i += 1) createTrace(i < 4 ? 'mira' : `traveller-${i}`, 'station', 'route', `route-${i}`, now + i)
const stationVisible = readWorld(archive, now + 100).visibleTracesByRegion.station
assert.equal(stationVisible.length, VISIBLE_TRACE_LIMIT)
assert.ok(stationVisible.filter((trace) => trace.authorUserId === 'mira').length <= 2)

for (const actor of ['mira', 'sana', 'jon', 'iko']) {
  commit({ ...base(actor), type: 'contribute_project', payload: { regionId: 'lighthouse', amount: 25, message: `${actor} repairs the lens.` } })
}
assert.equal(readWorld(archive, now).projects.lighthouse.progress, 100)

const resolveAction: WorldAction = { ...base('system', now + 8 * DAY), type: 'resolve_season', payload: { force: true } }
const resolved = commit(resolveAction)
assert.equal(readWorld(archive, now + 8 * DAY).anchors.length, 1)
const versionAfterResolve = archive.version
const duplicateResolve = commitWorldAction(archive, resolveAction)
assert.equal(duplicateResolve.duplicate, true)
assert.equal(duplicateResolve.archive.version, versionAfterResolve)

const rebuilt = rebuildArchive(JSON.parse(JSON.stringify({ ...archive, version: 9999, cursor: 9999, processedActionIds: [] })))
assert.equal(rebuilt.version, archive.version)
assert.equal(rebuilt.cursor, archive.cursor)
assert.deepEqual(readWorld(rebuilt, now + 8 * DAY).anchors, readWorld(archive, now + 8 * DAY).anchors)

const expiredUnanchored = createWorld(now)
const oldTrace = commitWorldAction(expiredUnanchored, {
  actionId: crypto.randomUUID(), actorUserId: 'old', expectedVersion: expiredUnanchored.version, createdAt: now,
  type: 'create_trace', payload: { regionId: 'archive', kind: 'message', message: 'This washes away.' },
}).archive
assert.equal(readWorld(oldTrace, now + 3 * DAY).visibleTracesByRegion.archive.length, 0)

console.log(`shared world engine ok · events=${archive.events.length} · version=${archive.version} · six-trace cap · TTL · idempotency · conflict · atomic aid · season anchor`)
