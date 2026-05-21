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

test('opportunity action uses entityName and normalizes advanced status', async () => {
  const calls = [];
  const registry = createAgentActionRegistry({
    sessionManager: {
      getSessionEntities: () => [{ id: 'sage', name: 'Sage', role: 'Staff TechOps Manager' }],
      updateEntity: (mode, entityId, patch) => {
        calls.push({ mode, entityId, patch });
        return { id: entityId, name: 'Sage', ...patch };
      }
    }
  });

  const result = await registry.confirmAction({
    actionType: 'updateOpportunity',
    payload: { entityName: 'Sage', outcome: 'move forward' }
  });

  assert.equal(result.ok, true);
  assert.equal(calls[0].entityId, 'sage');
  assert.equal(calls[0].patch.outcome, 'advanced');
});

test('create opportunity repairs company name from original request', async () => {
  const calls = [];
  const registry = createAgentActionRegistry({
    sessionManager: {
      updateEntity: (mode, entityId, patch) => {
        calls.push({ mode, entityId, patch });
        return { id: entityId, name: patch.name, ...patch };
      }
    }
  });

  const result = await registry.confirmAction({
    actionType: 'createOpportunity',
    payload: {
      originalUserMessage: 'add a new Opportunity with company name "ACME"'
    }
  });

  assert.equal(result.ok, true);
  assert.equal(calls[0].entityId, 'ACME');
  assert.equal(calls[0].patch.name, 'ACME');
});

test('opportunity action infers active context when entity name is missing', async () => {
  const calls = [];
  const registry = createAgentActionRegistry({
    activeContext: { mode: 'interview', entityId: 'acme', entityName: 'ACME' },
    sessionManager: {
      getSessionEntities: () => [{ id: 'acme', name: 'ACME' }],
      updateEntity: (mode, entityId, patch) => {
        calls.push({ mode, entityId, patch });
        return { id: entityId, name: 'ACME', ...patch };
      }
    }
  });

  const result = await registry.confirmAction({
    actionType: 'updateOpportunity',
    payload: { outcome: 'not moving forward' }
  });

  assert.equal(result.ok, true);
  assert.equal(calls[0].entityId, 'acme');
  assert.equal(calls[0].patch.outcome, 'rejected');
});

test('calendar action creates event from title date and entity name', async () => {
  const saves = [];
  const registry = createAgentActionRegistry({
    calendarStore: {
      saveEvent: (event) => {
        saves.push(event);
        return { ...event, id: 'evt-google' };
      }
    },
    sessionManager: {
      getSessionEntities: () => [{ id: 'google', name: 'Google' }]
    }
  });

  const result = await registry.confirmAction({
    actionType: 'saveCalendarEvent',
    payload: {
      title: 'Google CEO interview',
      date: '2026-05-26T15:00:00-04:00',
      entityName: 'Google',
      mode: 'interview'
    }
  });

  assert.equal(result.ok, true);
  assert.equal(saves[0].title, 'Google CEO interview');
  assert.equal(saves[0].entityId, 'google');
  assert.equal(saves[0].entityName, 'Google');
});

test('calendar delete matches by title date and entity name', async () => {
  const deleted = [];
  const registry = createAgentActionRegistry({
    calendarStore: {
      listEvents: () => [{
        id: 'evt-etsy',
        title: 'Etsy interview',
        date: '2026-05-26T15:00:00.000Z',
        entityId: 'etsy',
        entityName: 'Etsy'
      }],
      deleteEvent: (id) => {
        deleted.push(id);
        return true;
      }
    }
  });

  const result = await registry.confirmAction({
    actionType: 'deleteCalendarEvent',
    payload: { title: 'interview', date: '2026-05-26', entityName: 'Etsy' }
  });

  assert.equal(result.ok, true);
  assert.deepEqual(deleted, ['evt-etsy']);
});

test('calendar delete returns concrete clarification choices for ambiguous matches', async () => {
  const registry = createAgentActionRegistry({
    calendarStore: {
      listEvents: () => [
        { id: 'evt-1', title: 'Interview', date: '2026-05-26T15:00:00.000Z', entityName: 'Etsy' },
        { id: 'evt-2', title: 'Interview', date: '2026-05-26T18:00:00.000Z', entityName: 'Etsy' }
      ],
      deleteEvent: () => true
    }
  });

  const result = await registry.confirmAction({
    actionType: 'deleteCalendarEvent',
    payload: { title: 'interview', date: '2026-05-26', entityName: 'Etsy' }
  });

  assert.equal(result.ok, false);
  assert.equal(result.needsClarification, true);
  assert.match(result.message, /evt-1/);
  assert.match(result.message, /evt-2/);
});

test('opportunity action uses the original request entity before active context fallback', async () => {
  const calls = [];
  const registry = createAgentActionRegistry({
    activeContext: { mode: 'interview', entityId: 'curbwaste', entityName: 'CurbWaste' },
    sessionManager: {
      getSessionEntities: () => [
        { id: 'curbwaste', name: 'CurbWaste' },
        { id: 'teamviewer', name: 'TeamViewer' }
      ],
      updateEntity: (mode, entityId, patch) => {
        calls.push({ mode, entityId, patch });
        return { id: entityId, name: entityId, ...patch };
      }
    }
  });

  const result = await registry.confirmAction({
    actionType: 'updateOpportunity',
    payload: { outcome: 'rejected', originalUserMessage: 'change the status of the TeamViewer opportunity to Rejected' }
  });

  assert.equal(result.ok, true);
  assert.equal(calls[0].entityId, 'teamviewer');
  assert.equal(calls[0].patch.outcome, 'rejected');
});

test('calendar create repairs missing date title and entity from original request', async () => {
  const saves = [];
  const registry = createAgentActionRegistry({
    calendarStore: {
      saveEvent: (event) => {
        saves.push(event);
        return { ...event, id: 'evt-google' };
      }
    },
    sessionManager: {
      getSessionEntities: () => [{ id: 'google', name: 'Google', role: 'CEO' }]
    }
  });

  const result = await registry.confirmAction({
    actionType: 'saveCalendarEvent',
    payload: {
      mode: 'interview',
      originalUserMessage: 'schedule an interview on 5/27/2026 for a Recruiter Screen with Google for the CEO role'
    }
  });

  assert.equal(result.ok, true);
  assert.equal(saves[0].title, 'Recruiter Screen');
  assert.match(saves[0].date, /^2026-05-27/);
  assert.equal(saves[0].entityId, 'google');
  assert.equal(saves[0].entityName, 'Google');
});

test('calendar create sets interview association when request references interview', async () => {
  const saves = [];
  const registry = createAgentActionRegistry({
    now: () => new Date('2026-05-20T10:00:00-04:00'),
    calendarStore: {
      saveEvent: (event) => {
        saves.push(event);
        return { ...event, id: 'evt-google' };
      }
    },
    sessionManager: {
      getSessionEntities: () => [{ id: 'google', name: 'Google' }]
    }
  });

  const result = await registry.confirmAction({
    actionType: 'saveCalendarEvent',
    payload: {
      originalUserMessage: 'add an interview with Google next Tuesday'
    }
  });

  assert.equal(result.ok, true);
  assert.equal(saves[0].mode, 'interview');
  assert.equal(saves[0].associationMode, 'opportunity');
  assert.equal(saves[0].opportunityId, 'google');
});

test('calendar create sets meeting association and meeting name from original request', async () => {
  const saves = [];
  const registry = createAgentActionRegistry({
    now: () => new Date('2026-05-20T10:00:00-04:00'),
    calendarStore: {
      saveEvent: (event) => {
        saves.push(event);
        return { ...event, id: 'evt-project-check-in' };
      }
    },
    sessionManager: {
      getSessionEntities: (mode) => mode === 'meeting'
        ? [{ id: 'project-check-in', name: 'Project check-in' }]
        : []
    }
  });

  const result = await registry.confirmAction({
    actionType: 'saveCalendarEvent',
    payload: {
      originalUserMessage: "create a meeting. The meeting name is Project check-in and it's next Thursday at 1:00pm for company test 2"
    }
  });

  assert.equal(result.ok, true);
  assert.equal(saves[0].mode, 'meeting');
  assert.equal(saves[0].associationMode, 'meeting');
  assert.equal(saves[0].meetingId, 'project-check-in');
  assert.equal(saves[0].entityName, 'Project check-in');
  assert.equal(saves[0].color, '#00ffaa');
  assert.match(saves[0].date, /^2026-05-21T13:00/);
});

test('calendar create returns required field form when date is missing', async () => {
  const registry = createAgentActionRegistry({
    calendarStore: {
      saveEvent: () => {
        throw new Error('should not save');
      }
    },
    sessionManager: {
      getSessionEntities: () => []
    }
  });

  const result = await registry.confirmAction({
    actionType: 'saveCalendarEvent',
    payload: { title: 'Weekly Sync', mode: 'meeting' }
  });

  assert.equal(result.needsInput, true);
  assert.equal(result.requiredFields.some((field) => field.name === 'date' && field.type === 'datetime-local'), true);
});

test('create meeting returns required field form when name is missing', async () => {
  const registry = createAgentActionRegistry({
    sessionManager: {
      saveSession: () => {
        throw new Error('should not save');
      }
    }
  });

  const result = await registry.confirmAction({
    actionType: 'createMeeting',
    payload: {}
  });

  assert.equal(result.needsInput, true);
  assert.equal(result.requiredFields.some((field) => field.name === 'name'), true);
});

test('create meeting repairs meeting name from original request', async () => {
  const saves = [];
  const registry = createAgentActionRegistry({
    now: () => new Date('2026-05-20T10:00:00-04:00'),
    sessionManager: {
      saveSession: (record) => {
        saves.push(record);
        return record.id;
      }
    }
  });

  const result = await registry.confirmAction({
    actionType: 'createMeeting',
    payload: {
      originalUserMessage: "create a meeting. The meeting name is Project check-in and it's next Thursday at 1:00pm for company test 2"
    }
  });

  assert.equal(result.ok, true);
  assert.equal(saves[0].entity.name, 'Project check-in');
  assert.match(saves[0].date, /^2026-05-21T13:00/);
});

test('calendar create accepts tomorrow from original request', async () => {
  const saves = [];
  const registry = createAgentActionRegistry({
    now: () => new Date('2026-05-20T10:00:00-04:00'),
    calendarStore: {
      saveEvent: (event) => {
        saves.push(event);
        return { ...event, id: 'evt-google' };
      }
    },
    sessionManager: {
      getSessionEntities: () => [{ id: 'google', name: 'Google' }]
    }
  });

  const result = await registry.confirmAction({
    actionType: 'saveCalendarEvent',
    payload: {
      mode: 'interview',
      originalUserMessage: 'schedule a Recruiter Screen with Google tomorrow'
    }
  });

  assert.equal(result.ok, true);
  assert.match(saves[0].date, /^2026-05-21/);
});

test('calendar create accepts natural date from action payload', async () => {
  const saves = [];
  const registry = createAgentActionRegistry({
    now: () => new Date('2026-05-20T10:00:00-04:00'),
    calendarStore: {
      saveEvent: (event) => {
        saves.push(event);
        return { ...event, id: 'evt-google' };
      }
    },
    sessionManager: {
      getSessionEntities: () => [{ id: 'google', name: 'Google' }]
    }
  });

  const result = await registry.confirmAction({
    actionType: 'saveCalendarEvent',
    payload: {
      mode: 'interview',
      title: 'Recruiter Screen',
      entityName: 'Google',
      date: 'tomorrow'
    }
  });

  assert.equal(result.ok, true);
  assert.match(saves[0].date, /^2026-05-21/);
});

test('calendar create accepts next weekday from original request', async () => {
  const saves = [];
  const registry = createAgentActionRegistry({
    now: () => new Date('2026-05-20T10:00:00-04:00'),
    calendarStore: {
      saveEvent: (event) => {
        saves.push(event);
        return { ...event, id: 'evt-google' };
      }
    },
    sessionManager: {
      getSessionEntities: () => [{ id: 'google', name: 'Google' }]
    }
  });

  const result = await registry.confirmAction({
    actionType: 'saveCalendarEvent',
    payload: {
      mode: 'interview',
      originalUserMessage: 'schedule a Recruiter Screen with Google next Tuesday'
    }
  });

  assert.equal(result.ok, true);
  assert.match(saves[0].date, /^2026-05-26/);
});

test('calendar create accepts month and day without year from original request', async () => {
  const saves = [];
  const registry = createAgentActionRegistry({
    now: () => new Date('2026-05-20T10:00:00-04:00'),
    calendarStore: {
      saveEvent: (event) => {
        saves.push(event);
        return { ...event, id: 'evt-google' };
      }
    },
    sessionManager: {
      getSessionEntities: () => [{ id: 'google', name: 'Google' }]
    }
  });

  const result = await registry.confirmAction({
    actionType: 'saveCalendarEvent',
    payload: {
      mode: 'interview',
      originalUserMessage: 'schedule an interview on 5/27 with Google'
    }
  });

  assert.equal(result.ok, true);
  assert.match(saves[0].date, /^2026-05-27/);
});

test('calendar delete repairs title and date from original request before matching', async () => {
  const deleted = [];
  const registry = createAgentActionRegistry({
    calendarStore: {
      listEvents: () => [
        { id: 'evt-onsite', title: 'Interview #3 - Virtual Onsite 1 - Alex', date: '2026-05-22T15:00:00.000Z' },
        { id: 'evt-recruiter', title: 'Recruiter Screen', date: '2026-05-26T20:00:00.000Z' }
      ],
      deleteEvent: (id) => {
        deleted.push(id);
        return true;
      }
    }
  });

  const result = await registry.confirmAction({
    actionType: 'deleteCalendarEvent',
    payload: {
      originalUserMessage: 'delete the Recruiter Screen calendar event on 5/26/2026'
    }
  });

  assert.equal(result.ok, true);
  assert.deepEqual(deleted, ['evt-recruiter']);
});
