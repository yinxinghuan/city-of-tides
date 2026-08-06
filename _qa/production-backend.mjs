import { randomUUID } from 'node:crypto'

const apiBase = process.env.API_BASE || 'https://game.aiwaves.tech/city-of-tides'
const worldKey = `ship-${Date.now()}`

async function api(path, init = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Origin: 'https://yinxinghuan.github.io', ...(init.headers || {}) },
  })
  const body = await response.json().catch(() => ({}))
  return { response, body }
}

const health = await api('/api/health')
if (!health.response.ok || health.body.identity_mode !== 'unverified-production-beta' || health.body.lab_mode !== false) throw new Error(`bad health ${JSON.stringify(health.body)}`)

await api('/api/world/ensure', { method: 'POST', body: JSON.stringify({ world_key: worldKey, ruleset_id: 'city-of-tides-v1' }) })

async function state() {
  const result = await api(`/api/world/state?world_key=${worldKey}&event_limit=100`)
  if (!result.response.ok) throw new Error(`state failed ${JSON.stringify(result.body)}`)
  return result.body
}

async function action(userId, type, payload, actionId = randomUUID()) {
  const current = await state()
  const result = await api('/api/world/action', {
    method: 'POST',
    body: JSON.stringify({
      world_key: worldKey,
      action_id: actionId,
      user_id: userId,
      telegram_id: userId,
      actor_profile: { name: userId, avatar_url: '' },
      expected_version: current.version,
      ruleset_version: 1,
      type,
      payload,
    }),
  })
  if (!result.response.ok) throw new Error(`action ${type} failed ${JSON.stringify(result.body)}`)
  return result.body
}

const author = 'ship-author'
const traceActionId = randomUUID()
const traceResult = await action(author, 'create_trace', { regionId: 'market', kind: 'aid', message: 'Production verification aid.' }, traceActionId)
const traceId = traceResult.committed_events?.[0]?.payload?.traceId
if (!traceId) throw new Error('trace was not committed')

const duplicateState = await state()
const duplicate = await api('/api/world/action', {
  method: 'POST',
  body: JSON.stringify({ world_key: worldKey, action_id: traceActionId, user_id: author, telegram_id: author, expected_version: duplicateState.version, ruleset_version: 1, type: 'create_trace', payload: { regionId: 'market', kind: 'aid', message: 'Production verification aid.' } }),
})
if (!duplicate.response.ok || duplicate.body.duplicate !== true) throw new Error('idempotency failed')

await action('ship-claimer', 'claim_aid', { traceId })
const grants = await api(`/api/world/grants?world_key=${worldKey}&user_id=ship-claimer`)
const receiptId = grants.body.receipts?.[0]?.receipt_id
if (!receiptId) throw new Error('grant receipt missing')
const acknowledged = await api('/api/world/grant/ack', { method: 'POST', body: JSON.stringify({ world_key: worldKey, user_id: 'ship-claimer', receipt_id: receiptId }) })
if (!acknowledged.response.ok) throw new Error('grant ack failed')

for (const reporter of ['ship-report-a', 'ship-report-b', 'ship-report-c']) {
  const report = await api('/api/world/report', { method: 'POST', body: JSON.stringify({ world_key: worldKey, user_id: reporter, entity_id: traceId, reason: 'ship verification' }) })
  if (!report.response.ok) throw new Error(`report failed ${JSON.stringify(report.body)}`)
}
const hiddenState = await state()
if (hiddenState.active_traces.some((trace) => trace.traceId === traceId)) throw new Error('three-report hide failed')
if (hiddenState.snapshot.events.some((event) => event.payload?.traceId === traceId)) throw new Error('hidden trace leaked through snapshot')

const reset = await api('/api/world/lab/reset', { method: 'POST', body: JSON.stringify({ world_key: worldKey }) })
if (reset.response.status !== 404) throw new Error(`production lab reset unexpectedly available: ${reset.response.status}`)

console.log(`production backend ok · ${worldKey} · beta write · idempotency · grant ack · three-report hide · lab controls closed`)
