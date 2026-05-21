const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createCalendarStore } = require('../src/calendarStore');

test('calendar store saves, lists, and deletes events', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clyde-calendar-'));
  const store = createCalendarStore({ appPath: tempDir });

  const saved = store.saveEvent({
    title: 'Apollo onsite',
    date: '2026-05-22T15:00:00.000Z',
    associationMode: 'opportunity',
    entityId: 'Apollo'
  });

  assert.ok(saved.id);
  assert.equal(store.listEvents().length, 1);
  assert.equal(store.listEvents()[0].title, 'Apollo onsite');

  const updated = store.saveEvent({ ...saved, title: 'Apollo final onsite' });
  assert.equal(updated.id, saved.id);
  assert.equal(store.listEvents()[0].title, 'Apollo final onsite');

  assert.equal(store.deleteEvent(saved.id), true);
  assert.deepEqual(store.listEvents(), []);
});

test('calendar store imports renderer localStorage events once', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clyde-calendar-import-'));
  const store = createCalendarStore({ appPath: tempDir });

  const imported = store.importEvents([
    { id: 'evt-1', title: 'Imported', date: '2026-05-23T12:00:00.000Z' }
  ]);
  const importedAgain = store.importEvents([
    { id: 'evt-1', title: 'Imported duplicate', date: '2026-05-23T12:00:00.000Z' }
  ]);

  assert.equal(imported.length, 1);
  assert.equal(importedAgain.length, 1);
  assert.equal(store.listEvents()[0].title, 'Imported');
});
