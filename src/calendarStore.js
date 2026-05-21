const fs = require('node:fs');
const path = require('node:path');

function createCalendarStore({ appPath }) {
  if (!appPath) {
    throw new Error('appPath is required.');
  }

  const dir = path.join(appPath, 'Calendar');
  const eventsPath = path.join(dir, 'events.json');
  fs.mkdirSync(dir, { recursive: true });

  function listEvents() {
    return readEvents().sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  }

  function saveEvent(event = {}) {
    const events = readEvents();
    const id = clean(event.id) || `evt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const now = new Date().toISOString();
    const existing = events.find((item) => item.id === id);
    const nextEvent = {
      ...(existing || {}),
      ...event,
      id,
      title: clean(event.title || existing?.title || 'Scheduled item'),
      date: clean(event.date || existing?.date || now),
      updatedAt: now,
      createdAt: existing?.createdAt || clean(event.createdAt) || now
    };
    const nextEvents = existing
      ? events.map((item) => item.id === id ? nextEvent : item)
      : [...events, nextEvent];
    writeEvents(nextEvents);
    return nextEvent;
  }

  function deleteEvent(id) {
    const eventId = clean(id);
    if (!eventId) {
      return false;
    }
    const events = readEvents();
    const nextEvents = events.filter((event) => event.id !== eventId);
    writeEvents(nextEvents);
    return nextEvents.length !== events.length;
  }

  function importEvents(events = []) {
    const current = readEvents();
    const byId = new Map(current.map((event) => [event.id, event]));
    for (const event of Array.isArray(events) ? events : []) {
      const id = clean(event?.id);
      if (!id || byId.has(id)) {
        continue;
      }
      byId.set(id, {
        ...event,
        id,
        title: clean(event.title) || 'Scheduled item',
        date: clean(event.date) || new Date().toISOString()
      });
    }
    const nextEvents = Array.from(byId.values());
    writeEvents(nextEvents);
    return listEvents();
  }

  function readEvents() {
    try {
      if (!fs.existsSync(eventsPath)) {
        return [];
      }
      const parsed = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
      return Array.isArray(parsed) ? parsed.filter((event) => event && event.id) : [];
    } catch (_error) {
      return [];
    }
  }

  function writeEvents(events) {
    fs.writeFileSync(eventsPath, JSON.stringify(events, null, 2), 'utf8');
  }

  return {
    deleteEvent,
    eventsPath,
    importEvents,
    listEvents,
    saveEvent
  };
}

function clean(value) {
  return String(value || '').trim();
}

module.exports = {
  createCalendarStore
};
