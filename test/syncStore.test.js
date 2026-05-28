const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createSyncStore } = require('../src/syncStore');

test('sync store can clear proposals, audit rows, and cursors', () => {
  const appPath = fs.mkdtempSync(path.join(os.tmpdir(), 'clyde-sync-store-'));
  const store = createSyncStore({ appPath });

  store.upsertProposal({
    id: 'proposal-1',
    dedupeKey: 'company:apollo:advanced',
    status: 'pending',
    title: 'Mark Apollo advanced'
  });
  store.addAudit({ id: 'audit-1', message: 'Scanned Gmail.', status: 'success' });
  store.setCursor('gmail', 'cursor-1');

  assert.equal(store.listProposals({ status: 'pending' }).length, 1);
  assert.equal(store.listAudit().length, 1);
  assert.equal(store.getCursors().gmail, 'cursor-1');

  store.clearState();

  assert.deepEqual(store.listProposals({ status: 'pending' }), []);
  assert.deepEqual(store.listAudit(), []);
  assert.deepEqual(store.getCursors(), {});
});
