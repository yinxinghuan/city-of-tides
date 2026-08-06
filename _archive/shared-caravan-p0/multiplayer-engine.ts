import assert from 'node:assert/strict'
import {
  createInitialArchive,
  rebuildArchive,
  resolveRound,
  startNextRound,
  submitIntent,
  updateAbsencePolicy,
} from '../src/multiplayer/engine'
import { MultiplayerEngineError } from '../src/multiplayer/types'

let archive = createInitialArchive()
let replacementArchive = createInitialArchive()
replacementArchive = submitIntent(replacementArchive, {
  id: '10000000-0000-4000-8000-000000000001', round: 1, expectedVersion: 1,
  authorUserId: 'host', kind: 'scout', action: 'Scout once',
}).archive
replacementArchive = submitIntent(replacementArchive, {
  id: '10000000-0000-4000-8000-000000000002', round: 1, expectedVersion: 1,
  authorUserId: 'host', kind: 'guard', action: 'Change plan and guard',
}).archive
assert.equal(replacementArchive.snapshot.intents.host.kind, 'guard')
assert.equal(replacementArchive.events[1].type, 'intent_replaced')
assert.equal((replacementArchive.events[1].payload as { previousIntentId: string }).previousIntentId, '10000000-0000-4000-8000-000000000001')

const first = submitIntent(archive, {
  id: '00000000-0000-4000-8000-000000000001', round: 1, expectedVersion: 1,
  authorUserId: 'host', kind: 'forage', action: 'Gather dry food',
})
archive = first.archive
assert.equal(first.status, 'committed')
assert.equal(archive.events.length, 1)

const duplicate = submitIntent(archive, {
  id: '00000000-0000-4000-8000-000000000001', round: 1, expectedVersion: 1,
  authorUserId: 'host', kind: 'forage', action: 'Gather dry food',
})
assert.equal(duplicate.status, 'duplicate')
assert.equal(duplicate.archive.events.length, 1)

assert.throws(() => submitIntent(archive, {
  id: '00000000-0000-4000-8000-000000000002', round: 1, expectedVersion: 0,
  authorUserId: 'mira', kind: 'scout', action: 'Scout',
}), (error) => error instanceof MultiplayerEngineError && error.code === 'VERSION_CONFLICT')

for (const [id, member, kind] of [
  ['00000000-0000-4000-8000-000000000003', 'mira', 'forage'],
  ['00000000-0000-4000-8000-000000000004', 'oren', 'guard'],
  ['00000000-0000-4000-8000-000000000005', 'sela', 'negotiate'],
] as const) {
  archive = submitIntent(archive, { id, round: 1, expectedVersion: 1, authorUserId: member, kind, action: kind }).archive
}
assert.equal(Object.keys(archive.snapshot.intents).length, 4)

assert.throws(() => resolveRound(replacementArchive, {
  actionId: '10000000-0000-4000-8000-000000000003', round: 1, expectedVersion: 1, allowAbsence: false,
}), (error) => error instanceof MultiplayerEngineError && error.code === 'MEMBERS_MISSING')

const resolved = resolveRound(archive, {
  actionId: '00000000-0000-4000-8000-000000000006', round: 1, expectedVersion: 1, allowAbsence: false,
})
archive = resolved.archive
assert.equal(archive.snapshot.version, 2)
assert.equal(archive.snapshot.phase, 'resolved')
assert.deepEqual(archive.snapshot.stats, { vitality: 78, supplies: 9, renown: 3 })
const payload = resolved.event?.payload as { notes: string[] }
assert(payload.notes.includes('forage-conflict'))

const duplicateResolve = resolveRound(archive, {
  actionId: '00000000-0000-4000-8000-000000000006', round: 1, expectedVersion: 2, allowAbsence: false,
})
assert.equal(duplicateResolve.status, 'duplicate')
assert.equal(duplicateResolve.archive.snapshot.version, 2)
assert.throws(() => resolveRound(archive, {
  actionId: '00000000-0000-4000-8000-000000000007', round: 1, expectedVersion: 2, allowAbsence: false,
}), (error) => error instanceof MultiplayerEngineError && error.code === 'ROUND_ALREADY_RESOLVED')

archive = startNextRound(archive, {
  actionId: '00000000-0000-4000-8000-000000000008', round: 1, expectedVersion: 2,
}).archive
assert.equal(archive.snapshot.round, 2)
assert.equal(archive.snapshot.phase, 'collecting')

archive = updateAbsencePolicy(archive, 'mira', 'guard')
archive = submitIntent(archive, {
  id: '00000000-0000-4000-8000-000000000009', round: 2, expectedVersion: 2,
  authorUserId: 'host', kind: 'scout', action: 'Scout north',
}).archive
const absence = resolveRound(archive, {
  actionId: '00000000-0000-4000-8000-000000000010', round: 2, expectedVersion: 2, allowAbsence: true,
})
archive = absence.archive
const absencePayload = absence.event?.payload as { absentMemberIds: string[]; intents: Array<{ delegatedByPolicy?: string }> }
assert.deepEqual(absencePayload.absentMemberIds.sort(), ['mira', 'oren', 'sela'])
assert.equal(absencePayload.intents.filter((intent) => intent.delegatedByPolicy).length, 3)
assert.equal(archive.snapshot.version, 3)

const serialized = JSON.parse(JSON.stringify(archive))
serialized.snapshot.version = 999
serialized.snapshot.stats = { vitality: 0, supplies: 0, renown: -100 }
serialized.processedActionIds = []
const rebuilt = rebuildArchive(serialized)
assert.deepEqual(rebuilt.snapshot, archive.snapshot)
assert.deepEqual(rebuilt.events, archive.events)
assert.deepEqual(rebuilt.processedActionIds, archive.processedActionIds)

console.log(`multiplayer engine ok · events=${archive.events.length} · round=${archive.snapshot.round} · version=${archive.snapshot.version} · idempotent · conflict-safe · absence-resolved`)
