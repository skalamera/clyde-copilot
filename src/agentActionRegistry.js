const VALID_OUTCOMES = new Set(['active', 'advanced', 'rejected', 'offer']);

function createAgentActionRegistry(options = {}) {
  const sessionManager = options.sessionManager;
  const interviewManager = options.interviewManager;
  const calendarStore = options.calendarStore;
  const loadSettings = options.loadSettings || (() => ({}));
  const saveSettings = options.saveSettings || (() => {});
  const emitChange = options.emitChange || (() => {});
  const emitCalendarChanged = options.emitCalendarChanged || (() => {});
  const getNow = typeof options.now === 'function' ? options.now : () => new Date();
  const getActiveContext = typeof options.getActiveContext === 'function'
    ? options.getActiveContext
    : () => options.activeContext || {};

  async function confirmAction(action = {}) {
    const actionType = clean(action.actionType || action.type);
    const payload = repairActionPayload(actionType, {
      ...(action.payload || {}),
      originalUserMessage: action.originalUserMessage || action.payload?.originalUserMessage
    });

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
    if (actionType === 'saveCalendarEvent' || actionType === 'addInterviewMeetingRequest') {
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
    const match = resolveEntity('interview', entityQuery(payload, 'interview'));
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
    
    let detail = '';
    if (patch.outcome && patch.outcome !== match.entity.outcome) {
        const from = (match.entity.outcome || 'active').charAt(0).toUpperCase() + (match.entity.outcome || 'active').slice(1);
        const to = patch.outcome.charAt(0).toUpperCase() + patch.outcome.slice(1);
        detail = ` - ${from} to ${to}`;
    }
    
    return { ok: true, changed: true, message: `${updated.name || match.entity.name} updated${detail}.`, data: updated };
  }

  function createOpportunity(payload = {}) {
    const name = clean(payload.name || payload.entityName || payload.entityId || payload.company);
    if (!name) {
      return needsInputResult('Add the missing opportunity details.', [
        field('name', 'Company name', 'text', name, true),
        field('role', 'Role', 'text', payload.role || '', false)
      ], payload);
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
      return needsInputResult('Add the missing meeting details.', [
        field('name', 'Meeting name', 'text', name, true),
        field('date', 'Meeting date', 'datetime-local', payload.date || '', false),
        field('attendees', 'Attendees', 'textarea', attendeeText(payload.attendees), false)
      ], payload);
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
        attendees: parseAttendeesInput(payload.attendees)
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
    const date = normalizeCalendarDate(payload.date || payload.start || payload.startTime, payload.originalUserMessage, getNow());
    if (!date) {
      return needsInputResult('Add the missing calendar event details.', [
        field('title', 'Event title', 'text', payload.title || payload.name || '', true),
        field('date', 'Date and time', 'datetime-local', payload.date || payload.start || payload.startTime || '', true),
        field('mode', 'Event type', 'select', normalizeCalendarMode(payload.mode, payload.originalUserMessage), true, [
          { value: 'interview', label: 'Interview' },
          { value: 'meeting', label: 'Meeting' },
          { value: 'generic', label: 'Generic' }
        ]),
        field('entityName', 'Associated opportunity or meeting', 'text', payload.entityName || payload.company || payload.meetingName || '', false)
      ], payload);
    }
    const mode = normalizeCalendarMode(payload.mode, payload.originalUserMessage);
    const explicitEntityName = clean(payload.entityName || payload.company || payload.meetingName);
    const match = mode === 'generic'
      ? { ok: false }
      : resolveEntity(mode, explicitEntityName || entityQuery(payload, mode), { allowEmpty: true });
    const entity = match.ok ? match.entity : null;
    const entityName = clean(explicitEntityName || entity?.name || entity?.id);
    const title = clean(payload.title || payload.name || (entityName ? `${entityName} ${mode}` : 'Calendar event'));
    const associationMode = mode === 'meeting' ? 'meeting' : mode === 'generic' ? 'generic' : 'opportunity';
    const entityId = clean(explicitEntityName ? (entity?.id || explicitEntityName) : (payload.entityId || entity?.id || entityName));
    const saved = calendarStore.saveEvent({
      ...payload,
      title,
      date,
      mode,
      associationMode,
      entityId,
      entityName,
      opportunityId: associationMode === 'opportunity' ? entityId : '',
      meetingId: associationMode === 'meeting' ? entityId : '',
      color: calendarEventColor(associationMode, payload.color)
    });
    emitCalendarChanged({ reason: 'agent-action', eventId: saved.id });
    return { ok: true, changed: true, message: `Calendar event saved: ${saved.title} on ${new Date(saved.date).toLocaleString()}`, data: saved };
  }

  function deleteCalendarEvent(payload = {}) {
    if (!calendarStore?.deleteEvent) {
      return { ok: false, changed: false, message: 'Calendar is unavailable.' };
    }
    const match = resolveCalendarEvent(payload);
    if (!match.ok) {
      return match;
    }
    const deleted = calendarStore.deleteEvent(match.event.id);
    emitCalendarChanged({ reason: 'agent-action', eventId: match.event.id });
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

  function resolveEntity(mode, value, options = {}) {
    const query = clean(value).toLowerCase();
    if (!sessionManager?.getSessionEntities) {
      return { ok: false, changed: false, message: 'Session data is unavailable.' };
    }
    if (!query) {
      if (options.allowEmpty) {
        return { ok: false, changed: false, message: 'No entity selected.' };
      }
      return needsInputResult(mode === 'meeting' ? 'Choose a meeting.' : 'Choose an opportunity.', [
        field(mode === 'meeting' ? 'meetingTitle' : 'entityName', mode === 'meeting' ? 'Meeting name' : 'Opportunity name', 'select', '', true, entityOptions(mode))
      ], { mode });
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

  function resolveCalendarEvent(payload = {}) {
    const id = clean(payload.id || payload.eventId);
    const events = calendarStore?.listEvents ? calendarStore.listEvents() : [];
    if (id) {
      const event = events.find((item) => clean(item.id) === id);
      return event
        ? { ok: true, event }
        : { ok: true, event: { id } };
    }

    const title = normalizeText(payload.title || payload.name);
    const entityName = normalizeText(payload.entityName || payload.company || payload.meetingName || payload.entityId);
    const date = clean(payload.date || payload.start || payload.startTime).slice(0, 10);
    const matches = events.filter((event) => {
      const eventTitle = normalizeText(event.title || event.name);
      const eventEntity = normalizeText([
        event.entityName,
        event.entityId,
        event.company,
        event.meetingName,
        event.title
      ].filter(Boolean).join(' '));
      const eventDate = clean(event.date || event.start || event.startTime).slice(0, 10);
      const titleMatches = !title || eventTitle.includes(title) || title.includes(eventTitle);
      const entityMatches = !entityName || eventEntity.includes(entityName) || entityName.includes(eventEntity);
      const dateMatches = !date || eventDate === date;
      return titleMatches && entityMatches && dateMatches;
    });

    if (matches.length === 1) {
      return { ok: true, event: matches[0] };
    }
    if (matches.length > 1) {
      return {
        ok: false,
        changed: false,
        needsClarification: true,
        message: `Multiple calendar events matched: ${matches.map((event) => `${event.id}: ${event.title} at ${event.date}`).join('; ')}.`
      };
    }
    return { ok: false, changed: false, message: 'Calendar event not found.' };
  }

  function entityQuery(payload = {}, mode = 'interview') {
    const explicit = clean(
      payload.entityName
      || payload.entityId
      || payload.name
      || payload.company
      || payload.meetingName
      || payload.meetingTitle
    );
    if (explicit) {
      return explicit;
    }
    const fromRequest = extractEntityFromText(mode, payload.originalUserMessage);
    if (fromRequest) {
      return fromRequest;
    }
    const activeContext = getActiveContext() || {};
    if (activeContext.mode && activeContext.mode !== mode) {
      return '';
    }
    return clean(activeContext.entityName || activeContext.entityId || activeContext.company || activeContext.meetingTitle);
  }

  function entityOptions(mode) {
    if (!sessionManager?.getSessionEntities) {
      return [];
    }
    return sessionManager.getSessionEntities(mode).map((entity) => ({
      value: clean(entity.name || entity.id),
      label: clean(entity.name || entity.id)
    }));
  }

  return {
    confirmAction
  };

  function repairActionPayload(actionType, payload = {}) {
    const message = clean(payload.originalUserMessage);
    if (!message) {
      return payload;
    }

    if (actionType === 'updateOpportunity') {
      const entityFromRequest = extractEntityFromText('interview', message);
      return {
        ...payload,
        entityName: clean(entityFromRequest || payload.entityName || payload.entityId || payload.company),
        entityId: entityFromRequest ? '' : payload.entityId,
        outcome: clean(payload.outcome || extractOutcomeFromText(message))
      };
    }

    if (actionType === 'createOpportunity') {
      const name = clean(payload.name || payload.entityName || payload.company || extractOpportunityNameFromText(message));
      return {
        ...payload,
        name,
        entityName: clean(payload.entityName || name)
      };
    }

    if (actionType === 'createMeeting' || actionType === 'updateMeeting') {
      const name = clean(payload.name || payload.meetingTitle || extractMeetingNameFromText(message));
      return {
        ...payload,
        name,
        meetingTitle: clean(payload.meetingTitle || name),
        date: normalizeCalendarDate(payload.date || payload.start || payload.startTime, message, getNow())
      };
    }

    if (actionType === 'saveCalendarEvent' || actionType === 'addInterviewMeetingRequest') {
      const date = normalizeCalendarDate(payload.date || payload.start || payload.startTime, message, getNow());
      const mode = normalizeCalendarMode(payload.mode, message);
      const title = clean(payload.title || payload.name || extractCalendarTitleFromText(message));
      const entityFromRequest = extractEntityFromText(mode, message);
      const meetingName = mode === 'meeting' ? clean(payload.meetingName || extractMeetingNameFromText(message)) : '';
      const explicitEntityName = clean(payload.entityName || payload.company || meetingName);
      const entityName = clean(entityFromRequest || explicitEntityName || payload.entityId);
      return {
        ...payload,
        date,
        title: clean(title || meetingName || (mode === 'meeting' ? 'Meeting' : 'Interview')),
        meetingName,
        entityName,
        entityId: entityFromRequest || explicitEntityName ? '' : payload.entityId,
        mode
      };
    }

    if (actionType === 'deleteCalendarEvent') {
      const entityFromRequest = extractEntityFromText('interview', message);
      return {
        ...payload,
        date: normalizeCalendarDate(payload.date || payload.start || payload.startTime, message, getNow()),
        title: clean(payload.title || payload.name || extractCalendarTitleFromText(message)),
        entityName: clean(entityFromRequest || payload.entityName || payload.company),
        entityId: entityFromRequest ? '' : payload.entityId
      };
    }

    return payload;
  }

  function extractEntityFromText(mode, text) {
    if (!sessionManager?.getSessionEntities) {
      return '';
    }
    const normalized = normalizeText(text);
    if (!normalized) {
      return '';
    }
    const entities = sessionManager.getSessionEntities(mode);
    const matches = entities
      .filter((entity) => {
        const id = normalizeText(entity.id);
        const name = normalizeText(entity.name);
        return (id && normalized.includes(id)) || (name && normalized.includes(name));
      })
      .sort((a, b) => clean(b.name || b.id).length - clean(a.name || a.id).length);
    return clean(matches[0]?.name || matches[0]?.id);
  }
}

function needsInputResult(message, requiredFields, payload = {}) {
  return {
    ok: false,
    changed: false,
    needsInput: true,
    message,
    requiredFields,
    payload
  };
}

function field(name, label, type = 'text', value = '', required = true, options = []) {
  return {
    name,
    label,
    type,
    value: type === 'datetime-local' ? toDateTimeLocalValue(value) : clean(value),
    required: Boolean(required),
    options: Array.isArray(options) ? options : []
  };
}

function attendeeText(attendees) {
  if (!Array.isArray(attendees)) {
    return clean(attendees);
  }
  return attendees.map((attendee) => {
    if (typeof attendee === 'string') {
      return clean(attendee);
    }
    return [attendee.name, attendee.role].map(clean).filter(Boolean).join(': ');
  }).filter(Boolean).join('\n');
}

function parseAttendeesInput(value) {
  if (Array.isArray(value)) {
    return value.map((attendee) => {
      if (typeof attendee === 'string') {
        return { name: clean(attendee), role: '' };
      }
      return { name: clean(attendee.name), role: clean(attendee.role) };
    }).filter((attendee) => attendee.name);
  }
  return clean(value).split(/\r?\n|,/)
    .map((line) => {
      const [name, ...roleParts] = line.split(':');
      return { name: clean(name), role: clean(roleParts.join(':')) };
    })
    .filter((attendee) => attendee.name);
}

function toDateTimeLocalValue(value) {
  const raw = clean(value);
  if (!raw) {
    return '';
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function calendarEventColor(associationMode, fallback = '') {
  const mode = clean(associationMode).toLowerCase();
  if (mode === 'opportunity' || mode === 'interview') {
    return '#00e5ff';
  }
  if (mode === 'meeting') {
    return '#00ffaa';
  }
  return clean(fallback) || '#ffaa00';
}

function normalizeOutcome(value) {
  const outcome = clean(value).toLowerCase();
  if (VALID_OUTCOMES.has(outcome)) {
    return outcome;
  }
  if (/(reject|not moving forward|won't be moving forward|will not be moving forward|no longer moving forward|declin|pass)/i.test(outcome)) {
    return 'rejected';
  }
  if (/(advance|advanced|move forward|moving forward|next round|proceed|progress)/i.test(outcome)) {
    return 'advanced';
  }
  if (/offer/i.test(outcome)) {
    return 'offer';
  }
  return 'active';
}

function normalizeText(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9#]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeCalendarMode(value, text = '') {
  const explicit = clean(value).toLowerCase();
  if (explicit === 'meeting') {
    return 'meeting';
  }
  if (explicit === 'interview') {
    return 'interview';
  }
  if (explicit === 'generic') {
    return 'generic';
  }
  const normalized = normalizeText(text);
  if (/\bmeeting\b/.test(normalized)) {
    return 'meeting';
  }
  if (/\binterview\b/.test(normalized)) {
    return 'interview';
  }
  return 'interview';
}

function extractOutcomeFromText(text) {
  const normalized = normalizeText(text);
  if (/(reject|not moving forward|won t be moving forward|will not be moving forward|no longer moving forward|declin|pass)/i.test(normalized)) {
    return 'rejected';
  }
  if (/(advance|advanced|move forward|moving forward|next round|proceed|progress)/i.test(normalized)) {
    return 'advanced';
  }
  if (/offer/i.test(normalized)) {
    return 'offer';
  }
  return '';
}

function extractDateFromText(text, referenceDate = new Date()) {
  const value = clean(text);
  const base = validDate(referenceDate) ? new Date(referenceDate) : new Date();
  const slash = value.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slash) {
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    const explicitYear = slash[3] ? Number(slash[3]) : base.getFullYear();
    const year = explicitYear < 100 ? 2000 + explicitYear : explicitYear;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return formatLocalDateTime(new Date(year, month - 1, day, 12, 0, 0, 0), value);
    }
  }

  const iso = value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}T12:00:00.000`;
  }

  const normalized = normalizeText(value);
  if (/\btoday\b/.test(normalized)) {
    return formatLocalDateTime(addDays(base, 0), value);
  }
  if (/\btomorrow\b/.test(normalized)) {
    return formatLocalDateTime(addDays(base, 1), value);
  }

  const weekdayMatch = normalized.match(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (weekdayMatch) {
    const targetDay = WEEKDAYS.indexOf(weekdayMatch[2]);
    const currentDay = base.getDay();
    let delta = (targetDay - currentDay + 7) % 7;
    if (delta === 0) {
      delta += 7;
    }
    return formatLocalDateTime(addDays(base, delta), value);
  }

  return '';
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function normalizeCalendarDate(rawDate, fallbackText = '', referenceDate = new Date()) {
  const raw = clean(rawDate);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw;
  }
  return extractDateFromText([raw, fallbackText].filter(Boolean).join(' '), referenceDate);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  next.setDate(next.getDate() + days);
  return next;
}

function formatLocalDateTime(date, sourceText = '') {
  const time = extractTimeFromText(sourceText);
  const next = new Date(date);
  next.setHours(time.hours, time.minutes, 0, 0);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}T${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}:00.000`;
}

function extractTimeFromText(text) {
  const value = clean(text);
  const match = value.match(/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b/i);
  if (!match) {
    return { hours: 12, minutes: 0 };
  }
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = match[3].toLowerCase()[0];
  if (meridiem === 'p' && hours < 12) {
    hours += 12;
  }
  if (meridiem === 'a' && hours === 12) {
    hours = 0;
  }
  if (hours > 23 || minutes > 59) {
    return { hours: 12, minutes: 0 };
  }
  return { hours, minutes };
}

function validDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function extractCalendarTitleFromText(text) {
  const value = clean(text);
  const meetingName = extractMeetingNameFromText(value);
  if (meetingName) {
    return meetingName;
  }

  const forMatch = value.match(/\bfor (?:a |an |the )?(.+?)(?:\s+with\s+|\s+on\s+|\s+at\s+|$)/i);
  if (forMatch && clean(forMatch[1])) {
    return clean(forMatch[1]).replace(/\s+calendar event$/i, '');
  }

  const deleteMatch = value.match(/\bdelete (?:the )?(.+?)(?:\s+calendar event|\s+event|\s+on\s+|\s+at\s+|$)/i);
  if (deleteMatch && clean(deleteMatch[1])) {
    return clean(deleteMatch[1]);
  }

  return '';
}

function extractMeetingNameFromText(text) {
  const value = clean(text);
  const match = value.match(/\bmeeting name is\s+(.+?)(?:\s+and\b|\s+on\b|\s+at\b|$)/i);
  if (match && clean(match[1])) {
    return clean(match[1]).replace(/^["']|["']$/g, '');
  }
  const quoted = value.match(/\bmeeting\s+["']([^"']+)["']/i);
  if (quoted && clean(quoted[1])) {
    return clean(quoted[1]);
  }
  return '';
}

function extractOpportunityNameFromText(text) {
  const value = clean(text);
  const companyName = value.match(/\bcompany name\s+["']?([^"'.]+)["']?/i);
  if (companyName && clean(companyName[1])) {
    return clean(companyName[1]);
  }
  const named = value.match(/\b(?:opportunity|company)\s+(?:called|named|for)\s+["']?([^"'.]+)["']?/i);
  if (named && clean(named[1])) {
    return clean(named[1]);
  }
  return '';
}

function clean(value) {
  return String(value || '').trim();
}

module.exports = {
  createAgentActionRegistry
};
