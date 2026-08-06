import assert from 'node:assert/strict'
import { applyPendingGrants, emptyPlayerSave, includesGrantReceipts, normalizePlayerSave } from '../src/shared-world/playerInventory'

const first = { receiptId: 'receipt-a', sourceEntityId: 'aid-a', grant: { kind: 'lamp_cell', quantity: 1 }, createdAt: 100 }
const second = { receiptId: 'receipt-b', sourceEntityId: 'aid-b', grant: { kind: 'lamp_cell', quantity: 2 }, createdAt: 200 }

let save = applyPendingGrants(emptyPlayerSave(), [first])
assert.equal(save.inventory[0].quantity, 1)
assert.deepEqual(save.appliedGrantReceiptIds, ['receipt-a'])

save = applyPendingGrants(save, [first, second])
assert.equal(save.inventory[0].quantity, 3)
assert.deepEqual(save.inventory[0].receiptIds, ['receipt-a', 'receipt-b'])
assert.equal(save.inventory[0].lastReceivedAt, 200)
assert.equal(includesGrantReceipts(save, ['receipt-a', 'receipt-b']), true)

const duplicate = applyPendingGrants(save, [first, second])
assert.equal(duplicate.inventory[0].quantity, 3)
assert.equal(duplicate.appliedGrantReceiptIds.length, 2)

const repaired = normalizePlayerSave({ schemaVersion: 1, inventory: [{ kind: 'lamp_cell', quantity: 3, receiptIds: ['receipt-a', 'receipt-a'], lastReceivedAt: 200 }], appliedGrantReceiptIds: [] })
assert.deepEqual(repaired.appliedGrantReceiptIds, ['receipt-a'])

console.log('player inventory ok · receipt dedupe · aggregate quantity · reload repair')
