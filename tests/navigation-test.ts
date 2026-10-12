import assert from 'node:assert/strict'
import { historyIndex, resolveHistoryMove } from '../src/navigation/history'

assert.equal(historyIndex({ penjatIndex: 3 }), 3)
assert.equal(historyIndex({ penjatIndex: 0 }), 0)
for (const state of [null, undefined, {}, { penjatIndex: '2' }, { penjatIndex: 1.5 }]) assert.equal(historyIndex(state), null)

const base = { currentIndex: 2, currentUrl: '/aprendre/', targetUrl: '/', guarded: false, allowed: false }
// QA-01: Back (or Forward) out of an unfinished game is undone and confirmed first; the delta replays it on Confirm.
assert.deepEqual(resolveHistoryMove({ ...base, targetIndex: 1, guarded: true }), { action: 'confirm', delta: -1 })
assert.deepEqual(resolveHistoryMove({ ...base, targetIndex: 3, guarded: true }), { action: 'confirm', delta: 1 })
assert.deepEqual(resolveHistoryMove({ ...base, targetIndex: 0, guarded: true }), { action: 'confirm', delta: -2 })
// An entry the app did not write (unknown position) is still confirmed; the app pushes the shown page back instead.
assert.deepEqual(resolveHistoryMove({ ...base, targetIndex: null, guarded: true }), { action: 'confirm', delta: null })
// After Confirm the replayed move applies; unguarded moves apply directly.
assert.deepEqual(resolveHistoryMove({ ...base, targetIndex: 1, guarded: true, allowed: true }), { action: 'apply' })
assert.deepEqual(resolveHistoryMove({ ...base, targetIndex: 1 }), { action: 'apply' })
assert.deepEqual(resolveHistoryMove({ ...base, targetIndex: null }), { action: 'apply' })
// The undo landing back on the shown entry, and fragment-only changes, never re-prompt or change page.
assert.deepEqual(resolveHistoryMove({ ...base, targetIndex: 2, guarded: true }), { action: 'ignore' })
assert.deepEqual(resolveHistoryMove({ ...base, targetIndex: null, targetUrl: '/aprendre/', guarded: true }), { action: 'ignore' })
console.log('History navigation guard regressions passed')
