import { commitWorldAction, readWorld, rebuildArchive } from './engine'
import { createDemoWorld } from './demo'
import type { CommitResult, PendingGrantReceipt, WorldAction, WorldArchive, WorldEvent, WorldView } from './types'

export interface SharedWorldGateway {
  readonly mode: 'local' | 'remote'
  load(now?: number): Promise<{ archive: WorldArchive; view: WorldView }>
  commit(action: WorldAction): Promise<CommitResult>
  listPendingGrants(userId: string): Promise<PendingGrantReceipt[]>
  acknowledgeGrant(receiptId: string, userId: string): Promise<void>
  reportTrace(traceId: string, userId: string): Promise<void>
  reset(): Promise<WorldArchive>
}

export class LocalSharedWorldGateway implements SharedWorldGateway {
  readonly mode = 'local' as const
  constructor(private key = 'city-of-tides-shared-world-lab-v1') {}

  private readArchive() {
    try {
      const raw = alteruLocalStorage.getItem(this.key)
      if (raw) return rebuildArchive(JSON.parse(raw))
    } catch { /* fall through */ }
    const fresh = createDemoWorld()
    this.writeArchive(fresh)
    return fresh
  }

  private writeArchive(archive: WorldArchive) {
    alteruLocalStorage.setItem(this.key, JSON.stringify(archive))
  }

  async load(now = Date.now()) {
    const archive = this.readArchive()
    return { archive, view: readWorld(archive, now) }
  }

  async commit(action: WorldAction) {
    const current = this.readArchive()
    const result = commitWorldAction(current, action)
    if (result.archive !== current) this.writeArchive(result.archive)
    return result
  }

  async listPendingGrants() { return [] }
  async acknowledgeGrant() { /* local simulation has no private cloud save */ }
  async reportTrace() { /* local simulation has no public moderation queue */ }

  async reset() {
    const archive = createDemoWorld()
    this.writeArchive(archive)
    return archive
  }
}

/** Remote implementation for the per-game Durable Object staging API. */
export class RemoteSharedWorldGateway implements SharedWorldGateway {
  readonly mode = 'remote' as const

  constructor(private apiBase: string, private allowLabControls = false, private worldKey = 'main') {
    this.apiBase = apiBase.replace(/\/+$/, '')
  }

  private async api<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.apiBase}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    })
    const payload = await response.json().catch(() => ({ code: 'INVALID_ACTION' })) as T & { code?: string }
    if (!response.ok) {
      const error = new Error(payload.code || `HTTP_${response.status}`) as Error & { code?: string; payload?: unknown }
      error.code = payload.code || 'INVALID_ACTION'
      error.payload = payload
      throw error
    }
    return payload
  }

  async load(): Promise<{ archive: WorldArchive; view: WorldView }> {
    await this.api('/api/world/ensure', { method: 'POST', body: JSON.stringify({ world_key: this.worldKey, ruleset_id: 'city-of-tides-v1' }) })
    const state = await this.api<{ snapshot: unknown }>(`/api/world/state?world_key=${encodeURIComponent(this.worldKey)}&event_limit=100`)
    const archive = rebuildArchive(state.snapshot)
    return { archive, view: readWorld(archive) }
  }

  async commit(action: WorldAction): Promise<CommitResult> {
    let currentAction = action
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const current = await this.load()
      currentAction = { ...currentAction, expectedVersion: current.archive.version }
      try {
        const response = await this.api<{ duplicate: boolean; code: string; committed_events?: WorldEvent[] }>('/api/world/action', {
          method: 'POST',
          body: JSON.stringify({
            world_key: this.worldKey,
            action_id: currentAction.actionId,
            telegram_id: currentAction.actorUserId,
            user_id: currentAction.actorUserId,
            actor_profile: { name: currentAction.actorName, avatar_url: currentAction.actorAvatarUrl },
            expected_version: currentAction.expectedVersion,
            ruleset_version: 1,
            type: currentAction.type,
            payload: currentAction.payload,
          }),
        })
        const next = await this.load()
        return {
          accepted: true,
          duplicate: Boolean(response.duplicate),
          code: response.duplicate ? 'DUPLICATE_ACTION' : 'COMMITTED',
          archive: next.archive,
          committedEvents: response.committed_events || [],
        }
      } catch (error) {
        const code = error instanceof Error && 'code' in error ? String((error as Error & { code?: string }).code) : 'INVALID_ACTION'
        if (code === 'VERSION_CONFLICT') continue
        throw error
      }
    }
    const error = new Error('VERSION_CONFLICT') as Error & { code: string }
    error.code = 'VERSION_CONFLICT'
    throw error
  }

  async listPendingGrants(userId: string): Promise<PendingGrantReceipt[]> {
    const response = await this.api<{ receipts?: Array<{ receipt_id?: string; source_entity_id?: string; grant?: { kind?: string; quantity?: number }; created_at?: number }> }>(`/api/world/grants?world_key=${encodeURIComponent(this.worldKey)}&user_id=${encodeURIComponent(userId)}&status=pending`)
    return (response.receipts || []).flatMap((receipt) => {
      if (!receipt.receipt_id || !receipt.source_entity_id || !receipt.grant?.kind) return []
      return [{
        receiptId: receipt.receipt_id,
        sourceEntityId: receipt.source_entity_id,
        grant: { kind: receipt.grant.kind, quantity: Math.max(1, Math.floor(Number(receipt.grant.quantity) || 1)) },
        createdAt: Number(receipt.created_at) || Date.now(),
      }]
    })
  }

  async acknowledgeGrant(receiptId: string, userId: string): Promise<void> {
    await this.api('/api/world/grant/ack', {
      method: 'POST',
      body: JSON.stringify({ world_key: this.worldKey, receipt_id: receiptId, user_id: userId, telegram_id: userId }),
    })
  }

  async reportTrace(traceId: string, userId: string): Promise<void> {
    await this.api('/api/world/report', {
      method: 'POST',
      body: JSON.stringify({ world_key: this.worldKey, entity_id: traceId, user_id: userId, telegram_id: userId, reason: 'player_report' }),
    })
  }

  async reset(): Promise<WorldArchive> {
    if (!this.allowLabControls) {
      const error = new Error('INVALID_ACTION') as Error & { code: string }
      error.code = 'INVALID_ACTION'
      throw error
    }
    const result = await this.api<{ snapshot: unknown }>('/api/world/lab/reset', { method: 'POST', body: JSON.stringify({ world_key: this.worldKey }) })
    return rebuildArchive(result.snapshot)
  }
}
