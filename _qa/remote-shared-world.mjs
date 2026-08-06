import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const apiBase = (process.env.API_BASE || '').replace(/\/+$/, '')
assert(apiBase, 'API_BASE is required')
const worldKey = `qa-${Date.now()}`

async function api(path, init) {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  const payload = await response.json()
  return { status: response.status, payload }
}

async function state() {
  const result = await api(`/api/world/state?world_key=${encodeURIComponent(worldKey)}&event_limit=200`)
  assert.equal(result.status, 200)
  return result.payload
}

async function action(userId, type, payload, options = {}) {
  const actionId = options.actionId || randomUUID()
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await state()
    const expectedVersion = options.expectedVersion ?? current.version
    const result = await api('/api/world/action', {
      method: 'POST',
      body: JSON.stringify({
        world_key: worldKey,
        action_id: actionId,
        telegram_id: userId,
        user_id: userId,
        actor_profile: { name: userId, avatar_url: '' },
        expected_version: expectedVersion,
        ruleset_version: 1,
        type,
        payload,
      }),
    })
    if (result.payload.code !== 'VERSION_CONFLICT' || options.expectedVersion != null) return { ...result, actionId }
  }
  throw new Error('conflict retries exhausted')
}

const ensured = await api('/api/world/ensure', { method: 'POST', body: JSON.stringify({ world_key: worldKey, ruleset_id: 'city-of-tides-v1' }) })
assert.equal(ensured.status, 200)
assert.equal(ensured.payload.version, 1)

const warning = await action('qa-a', 'create_trace', { regionId: 'lighthouse', kind: 'warning', message: 'QA warning from another arrival.' })
assert.equal(warning.payload.accepted, true)
const duplicate = await action('qa-a', 'create_trace', { regionId: 'lighthouse', kind: 'warning', message: 'must not duplicate' }, { actionId: warning.actionId })
assert.equal(duplicate.payload.duplicate, true)
assert.equal((await state()).version, 2)

const stale = await action('qa-b', 'reinforce_trace', { traceId: warning.payload.committed_events[0].payload.traceId }, { expectedVersion: 1 })
assert.equal(stale.status, 409)
assert.equal(stale.payload.code, 'VERSION_CONFLICT')

const reinforce = await action('qa-b', 'reinforce_trace', { traceId: warning.payload.committed_events[0].payload.traceId })
assert.equal(reinforce.payload.accepted, true)

const aid = await action('qa-c', 'create_trace', { regionId: 'market', kind: 'aid', message: 'Three sealed QA lamp cells.' })
const aidId = aid.payload.committed_events[0].payload.traceId
const claimResults = await Promise.all(['qa-d', 'qa-e', 'qa-f', 'qa-g'].map((userId) => action(userId, 'claim_aid', { traceId: aidId })))
assert.equal(claimResults.filter((result) => result.payload.accepted).length, 3)
assert.equal(claimResults.filter((result) => result.payload.code === 'ITEM_UNAVAILABLE').length, 1)

for (let index = 0; index < 8; index += 1) {
  const result = await action(`trace-${index}`, 'create_trace', { regionId: 'archive', kind: 'message', message: `Archive QA trace ${index}` })
  assert.equal(result.payload.accepted, true)
}
assert.equal((await state()).active_traces.filter((trace) => trace.regionId === 'archive').length, 6)

for (const userId of ['project-a', 'project-b', 'project-c', 'project-d']) {
  const result = await action(userId, 'contribute_project', { regionId: 'station', amount: 999, message: 'QA contribution' })
  assert.equal(result.payload.accepted, true)
}
const beforeResolve = await state()
assert.equal(beforeResolve.projects.find((project) => project.regionId === 'station').progress, 100)
const resolved = await action('qa-system', 'resolve_season', { force: true })
assert.equal(resolved.payload.accepted, true)
const finalState = await state()
assert.equal(finalState.anchors.filter((anchor) => anchor.regionId === 'station').length, 1)

const grants = await api(`/api/world/grants?world_key=${encodeURIComponent(worldKey)}&user_id=qa-d&status=pending`)
assert.equal(grants.payload.receipts.length, 1)
const receiptId = grants.payload.receipts[0].receipt_id
const acknowledged = await api('/api/world/grant/ack', {
  method: 'POST',
  body: JSON.stringify({ world_key: worldKey, receipt_id: receiptId, user_id: 'qa-d', telegram_id: 'qa-d' }),
})
assert.equal(acknowledged.status, 200)
assert.equal(acknowledged.payload.ok, true)
const afterAck = await api(`/api/world/grants?world_key=${encodeURIComponent(worldKey)}&user_id=qa-d&status=pending`)
assert.equal(afterAck.payload.receipts.length, 0)

console.log(`remote shared world ok · ${worldKey} · version=${finalState.version} · cursor=${finalState.cursor} · traces=6 cap · 3/4 atomic claims · grant ack · permanent anchor`)
