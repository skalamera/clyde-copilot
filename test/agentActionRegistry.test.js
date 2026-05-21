const assert = require('node:assert/strict');
const test = require('node:test');

const { createAgentActionRegistry } = require('../src/agentActionRegistry');

test('confirmed updateOpportunity action marks matching opportunity rejected', async () => {
  const calls = [];
  const registry = createAgentActionRegistry({
    sessionManager: {
      getSessionEntities: () => [{ id: 'Apollo', name: 'Apollo', role: 'Support Operations Manager' }],
      updateEntity: (mode, entityId, patch) => {
        calls.push({ mode, entityId, patch });
        return { id: entityId, name: entityId, ...patch };
      }
    },
    emitChange: (change) => calls.push({ change })
  });

  const result = await registry.confirmAction({
    actionType: 'updateOpportunity',
    payload: { entityId: 'Apollo', outcome: 'rejected' }
  });

  assert.equal(result.ok, true);
  assert.equal(calls[0].mode, 'interview');
  assert.equal(calls[0].entityId, 'Apollo');
  assert.equal(calls[0].patch.outcome, 'rejected');
  assert.equal(calls[1].change.reason, 'agent-action');
});

test('ambiguous opportunity action asks for clarification instead of mutating', async () => {
  let mutated = false;
  const registry = createAgentActionRegistry({
    sessionManager: {
      getSessionEntities: () => [
        { id: 'acme-1', name: 'ACME' },
        { id: 'acme-2', name: 'ACME Support' }
      ],
      updateEntity: () => {
        mutated = true;
      }
    }
  });

  const result = await registry.confirmAction({
    actionType: 'updateOpportunity',
    payload: { entityId: 'ACME', outcome: 'rejected' }
  });

  assert.equal(result.ok, false);
  assert.equal(result.needsClarification, true);
  assert.equal(mutated, false);
});

test('calendar actions are routed through calendar store', async () => {
  const calls = [];
  const registry = createAgentActionRegistry({
    calendarStore: {
      saveEvent: (event) => {
        calls.push({ save: event });
        return { ...event, id: event.id || 'evt-1' };
      },
      deleteEvent: (id) => {
        calls.push({ delete: id });
        return true;
      }
    },
    emitCalendarChanged: (event) => calls.push({ event })
  });

  const created = await registry.confirmAction({
    actionType: 'saveCalendarEvent',
    payload: { title: 'Apollo prep', date: '2026-05-22T14:00:00.000Z' }
  });
  const deleted = await registry.confirmAction({
    actionType: 'deleteCalendarEvent',
    payload: { id: 'evt-1' }
  });

  assert.equal(created.ok, true);
  assert.equal(deleted.ok, true);
  assert.equal(calls[0].save.title, 'Apollo prep');
  assert.equal(calls[2].delete, 'evt-1');
});
