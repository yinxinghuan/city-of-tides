import type { CityPlayerSave, PendingGrantReceipt, PlayerInventoryItem } from './types'

export function emptyPlayerSave(): CityPlayerSave {
  return { schemaVersion: 1, inventory: [], appliedGrantReceiptIds: [] }
}

export function normalizePlayerSave(candidate: unknown): CityPlayerSave {
  const value = candidate as Partial<CityPlayerSave> | null
  if (!value || value.schemaVersion !== 1) return emptyPlayerSave()
  const applied = new Set((Array.isArray(value.appliedGrantReceiptIds) ? value.appliedGrantReceiptIds : []).filter((id): id is string => typeof id === 'string' && id.length > 0))
  const inventory = (Array.isArray(value.inventory) ? value.inventory : [])
    .filter((item): item is PlayerInventoryItem => Boolean(item && typeof item.kind === 'string' && item.kind && Number.isFinite(item.quantity)))
    .map((item) => ({
      kind: item.kind,
      quantity: Math.max(0, Math.floor(item.quantity)),
      receiptIds: Array.from(new Set((Array.isArray(item.receiptIds) ? item.receiptIds : []).filter((id): id is string => typeof id === 'string' && id.length > 0))),
      lastReceivedAt: Number.isFinite(item.lastReceivedAt) ? item.lastReceivedAt : 0,
    }))
    .filter((item) => item.quantity > 0)
  inventory.forEach((item) => item.receiptIds.forEach((id) => applied.add(id)))
  return { schemaVersion: 1, inventory, appliedGrantReceiptIds: [...applied], ...(value.hasEntered ? { hasEntered: true } : {}), ...(value._lastActive ? { _lastActive: value._lastActive } : {}) }
}

export function applyPendingGrants(save: CityPlayerSave, receipts: PendingGrantReceipt[]): CityPlayerSave {
  const next = normalizePlayerSave(save)
  const applied = new Set(next.appliedGrantReceiptIds)
  const inventory = next.inventory.map((item) => ({ ...item, receiptIds: [...item.receiptIds] }))
  let changed = false

  for (const receipt of receipts) {
    if (!receipt.receiptId || applied.has(receipt.receiptId)) continue
    const quantity = Math.max(1, Math.floor(Number(receipt.grant.quantity) || 1))
    const existing = inventory.find((item) => item.kind === receipt.grant.kind)
    if (existing) {
      existing.quantity += quantity
      existing.receiptIds.push(receipt.receiptId)
      existing.lastReceivedAt = Math.max(existing.lastReceivedAt, receipt.createdAt)
    } else {
      inventory.push({ kind: receipt.grant.kind, quantity, receiptIds: [receipt.receiptId], lastReceivedAt: receipt.createdAt })
    }
    applied.add(receipt.receiptId)
    changed = true
  }

  return changed ? { ...next, inventory, appliedGrantReceiptIds: [...applied] } : next
}

export function includesGrantReceipts(save: unknown, receiptIds: string[]): boolean {
  const applied = new Set(normalizePlayerSave(save).appliedGrantReceiptIds)
  return receiptIds.every((id) => applied.has(id))
}
