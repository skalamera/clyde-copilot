const VALID_OUTCOMES = new Set(['active', 'advanced', 'rejected', 'offer']);

function createAgentActionRegistry(options = {}) {
  const sessionManager = options.sessionManager;
  const interviewManager = options.interviewManager;
  const calendarStore = options.calendarStore;
  const loadSettings = options.loadSettings || (() => ({}));
  const saveSettings = options.saveSettings || (() => {});
  const emitChange = options.emitChange || (() => {});
  const emitCalendarChanged = options.emitCalendarChanged || (() => {});

  async function confirmAction(action = {}) {
    const actionType = clean(action.actionType || action.type);
    const payload = action.payload || {};

    if (actionType === 'updateOpportunity') {
      return updateOpportunity(payload);
    }
    if (actionType === 'createOpportunity') {
      return createOpportunity(payload);
    }
    if (actionType === 'deleteOpportunity') {
      return deleteEntity('interview', payload);
    }
    if (actionType === 'createMeeting' || actionType === 'updateMeeting') {
      return saveMeeting(payload);
    }
    if (actionType === 'deleteMeeting') {
      return deleteEntity('meeting', payload);
    }
    if (actionType === 'saveCalendarEvent') {
      return saveCalendarEvent(payload);
    }
    if (actionType === 'deleteCalendarEvent') {
      return deleteCalendarEvent(payload);
    }
    if (actionType === 'deleteSession') {
      return deleteSession(payload);
    }
    if (actionType === 'setActiveContext') {
      return setActiveContext(payload);
    }

    return { ok: false, changed: false, message: `Unsupported action: ${actionType || 'unknown'}` };
  }

  function updateOpportunity(payload = {}) {
    const match = resolveEntity('interview', payload.entityId || payload.name || payload.company);
    if (!match.ok) {
      return match;
    }
    const patch = {
      ...(payload.name ? { name: clean(payload.name) } : {}),
      ...(payload.role !== undefined ? { role: clean(payload.role) } : {}),
      ...(payload.outcome !== undefined ? { outcome: normalizeOutcome(payload.outcome) } : {}),
      ...(payload.outcomeReason !== undefined ? { outcomeReason: clean(payload.outcomeReason) } : {}),
      ...(payload.outcomeDate !== undefined ? { outcomeDate: clean(payload.outcomeDate) } : {})
    };
    const updated = sessionManager.updateEntity('interview', match.entity.id, patch);
    if (patch.role !== undefined && interviewManager?.setCompanyRole) {
      try {
        interviewManager.setCompanyRole(match.entity.id, patch.role);
      } catch (_error) {}
    }
    emitChange({ mode: 'interview', entityId: match.entity.id, reason: 'agent-action' });
    return { ok: true, changed: true, message: `${updated.name || match.entity.name} updated.`, data: updated };
  }

  function createOpportunity(payload = {}) {
    const name = clean(payload.name || payload.entityId || payload.company);
    if (!name) {
      return { ok: false, changed: false, message: 'Opportunity name is required.' };
    }
    const updated = sessionManager.updateEntity('interview', name, {
      name,
      role: clean(payload.role),
      outcome: normalizeOutcome(payload.outcome || 'active')
    });
    emitChange({ mode: 'interview', entityId: updated.id, reason: 'agent-action' });
    return { ok: true, changed: true, message: `${updated.name} created.`, data: updated };
  }

  function saveMeeting(payload = {}) {
    const name = clean(payload.name || payload.entityId || payload.meetingTitle);
    if (!name) {
      return { ok: false, changed: false, message: 'Meeting name is required.' };
    }
    const record = {
      id: payload.sessionId || `meeting-${Date.now()}`,
      mode: 'meeting',
      title: clean(payload.title || name),
      date: clean(payload.date) || new Date().toISOString(),
      entity: {
        id: clean(payload.entityId || name),
        name,
        kind: 'meeting',
        attendees: Array.isArray(payload.attendees) ? payload.attendees : []
      },
      transcript: Array.isArray(payload.transcript) ? payload.transcript : [],
      notes: {
        summary: clean(payload.memory || payload.summary),
        actionItems: []
      }
    };
    const id = sessionManager.saveSession(record);
    emitChange({ mode: 'meeting', entityId: record.entity.id, reason: 'agent-action' });
    return { ok: true, changed: true, message: `${name} saved.`, data: { ...record, id } };
  }

  function deleteEntity(mode, payload = {}) {
    const match = resolveEntity(mode, payload.entityId || payload.name || payload.company || payload.meetingTitle);
    if (!match.ok) {
      return match;
    }
    const deleted = sessionManager.deleteEntity(mode, match.entity.id);
    emitChange({ mode, entityId: match.entity.id, reason: 'agent-action' });
    return { ok: Boolean(deleted), changed: Boolean(deleted), message: `${match.entity.name || match.entity.id} deleted.` };
  }

  function saveCalendarEvent(payload = {}) {
    if (!calendarStore?.saveEvent) {
      return { ok: false, changed: false, message: 'Calendar is unavailable.' };
    }
    const saved = calendarStore.saveEvent(payload);
    emitCalendarChanged({ reason: 'agent-action', eventId: saved.id });
    return { ok: true, changed: true, message: `${saved.title} saved.`, data: saved };
  }

  function deleteCalendarEvent(payload = {}) {
    if (!calendarStore?.deleteEvent) {
      return { ok: false, changed: false, message: 'Calendar is unavailable.' };
    }
    const id = clean(payload.id || payload.eventId);
    const deleted = calendarStore.deleteEvent(id);
    emitCalendarChanged({ reason: 'agent-action', eventId: id });
    return { ok: deleted, changed: deleted, message: deleted ? 'Calendar event deleted.' : 'Calendar event not found.' };
  }

  function deleteSession(payload = {}) {
    const deleted = sessionManager.deleteSession({
      mode: payload.mode,
      id: payload.id || payload.sessionId,
      entityId: payload.entityId
    });
    emitChange({ mode: payload.mode, entityId: payload.entityId, reason: 'agent-action' });
    return { ok: Boolean(deleted), changed: Boolean(deleted), message: deleted ? 'Session deleted.' : 'Session not found.' };
  }

  function setActiveContext(payload = {}) {
    const settings = loadSettings();
    const mode = payload.mode === 'meeting' ? 'meeting' : 'interview';
    const nextSettings = {
      ...settings,
      appMode: mode,
      currentCompany: mode === 'interview' ? clean(payload.entityId || payload.company) : settings.currentCompany,
      currentRole: mode === 'interview' ? clean(payload.role) : settings.currentRole,
      meetingTitle: mode === 'meeting' ? clean(payload.meetingTitle || payload.name || payload.entityId) : settings.meetingTitle,
      meetingAttendees: mode === 'meeting' && Array.isArray(payload.attendees) ? payload.attendees : settings.meetingAttendees
    };
    saveSettings(nextSettings);
    emitChange({ mode, entityId: mode === 'interview' ? nextSettings.currentCompany : nextSettings.meetingTitle, reason: 'agent-action' });
    return { ok: true, changed: true, message: 'Active context updated.', data: nextSettings };
  }

  function resolveEntity(mode, value) {
    const query = clean(value).toLowerCase();
    if (!sessionManager?.getSessionEntities) {
      return { ok: false, changed: false, message: 'Session data is unavailable.' };
    }
    if (!query) {
      return { ok: false, changed: false, message: 'Entity name is required.' };
    }
    const entities = sessionManager.getSessionEntities(mode);
    const matches = entities.filter((entity) => {
      const id = clean(entity.id).toLowerCase();
      const name = clean(entity.name).toLowerCase();
      return id === query || name === query || id.includes(query) || name.includes(query);
    });
    if (matches.length === 1) {
      return { ok: true, entity: matches[0] };
    }
    if (matches.length > 1) {
      return {
        ok: false,
        changed: false,
        needsClarification: true,
        message: `Multiple matches found: ${matches.map((item) => item.name || item.id).join(', ')}.`
      };
    }
    return { ok: false, changed: false, needsClarification: true, message: `No matching ${mode} found for "${value}".` };
  }

  return {
    confirmAction
  };
}

function normalizeOutcome(value) {
  const outcome = clean(value).toLowerCase();
  return VALID_OUTCOMES.has(outcome) ? outcome : 'active';
}

function clean(value) {
  return String(value || '').trim();
}

module.exports = {
  createAgentActionRegistry
};
