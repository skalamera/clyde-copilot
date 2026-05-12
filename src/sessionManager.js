const fs = require('node:fs');
const path = require('node:path');

function createSessionManager({ appPath }) {
  if (!appPath) {
    throw new Error('appPath is required.');
  }

  const sessionsDir = path.join(appPath, 'Sessions');
  fs.mkdirSync(sessionsDir, { recursive: true });

  function getSessions(filters = {}) {
    const mode = normalizeMode(filters.mode);
    const entityId = filters.entityId ? sanitizeId(filters.entityId) : '';
    const sessions = [
      ...readNativeSessions({ mode, entityId }),
      ...(mode === 'interview' ? readLegacyInterviewSessions(entityId) : [])
    ];

    return dedupeSessions(sessions)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }

  function saveSession(record = {}) {
    const session = normalizeSessionRecord(record);
    const entityId = sanitizeId(session.entity.id || session.entity.name || 'general');
    const entityDir = path.join(sessionsDir, session.mode, entityId);
    fs.mkdirSync(entityDir, { recursive: true });

    fs.writeFileSync(
      path.join(entityDir, `${session.id}.json`),
      JSON.stringify(session, null, 2),
      'utf8'
    );

    writeEntityMeta(session.mode, entityId, session.entity);
    return session.id;
  }

  function deleteSession({ mode, id, entityId }) {
    const normalizedMode = normalizeMode(mode);
    const normalizedEntityId = entityId ? sanitizeId(entityId) : '';
    const targets = normalizedEntityId
      ? [path.join(sessionsDir, normalizedMode, normalizedEntityId, `${id}.json`)]
      : findSessionFiles(normalizedMode, id);

    for (const target of targets) {
      if (fs.existsSync(target)) {
        fs.unlinkSync(target);
      }
    }

    return true;
  }

  function deleteEntity(mode, entityId) {
    const normalizedMode = normalizeMode(mode);
    const normalizedEntityId = sanitizeId(entityId);
    if (!normalizedEntityId) return false;

    const entityDir = path.join(sessionsDir, normalizedMode, normalizedEntityId);
    if (fs.existsSync(entityDir)) {
      fs.rmSync(entityDir, { recursive: true, force: true });
    }
    return true;
  }

  function getSessionEntities(mode = 'interview') {
    const normalizedMode = normalizeMode(mode);
    const nativeEntities = readNativeEntities(normalizedMode);
    const legacyEntities = normalizedMode === 'interview' ? readLegacyInterviewEntities() : [];
    const byId = new Map();

    for (const entity of [...legacyEntities, ...nativeEntities]) {
      byId.set(entity.id, { ...(byId.get(entity.id) || {}), ...entity });
    }

    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

    function writeEntityMeta(mode, entityId, entity) {
      const entityDir = path.join(sessionsDir, normalizeMode(mode), entityId);
      fs.mkdirSync(entityDir, { recursive: true });
      fs.writeFileSync(path.join(entityDir, 'meta.json'), JSON.stringify({
        id: entityId,
        name: entity.name || entityId,
        role: entity.role || '',
        kind: entity.kind || normalizeMode(mode),
        confidence_score: entity.confidence_score !== undefined ? entity.confidence_score : 0,
        trend: entity.trend || 'neutral'
      }, null, 2), 'utf8');
    }

    function updateEntityConfidence(entityId, score, trend) {
      const entityDir = path.join(sessionsDir, 'interview', entityId);
      const metaPath = path.join(entityDir, 'meta.json');
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          meta.confidence_score = score;
          meta.trend = trend;
          fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
        } catch(e) {}
      }
    }

  function readNativeSessions({ mode, entityId }) {
    const modeDir = path.join(sessionsDir, mode);
    if (!fs.existsSync(modeDir)) {
      return [];
    }

    const entityDirs = entityId
      ? [path.join(modeDir, entityId)]
      : fs.readdirSync(modeDir, { withFileTypes: true })
        .filter((item) => item.isDirectory())
        .map((item) => path.join(modeDir, item.name));

    const sessions = [];
    for (const entityDir of entityDirs) {
      if (!fs.existsSync(entityDir)) {
        continue;
      }

      const files = fs.readdirSync(entityDir).filter((file) => file.endsWith('.json') && file !== 'meta.json');
      for (const file of files) {
        const record = readJsonFile(path.join(entityDir, file));
        if (record) {
          sessions.push(normalizeSessionRecord(record));
        }
      }
    }

    return sessions;
  }

    function readNativeEntities(mode) {
      const modeDir = path.join(sessionsDir, mode);
      if (!fs.existsSync(modeDir)) {
        return [];
      }

      return fs.readdirSync(modeDir, { withFileTypes: true })
        .filter((item) => item.isDirectory())
        .map((item) => {
          const entityId = item.name;
          const meta = readJsonFile(path.join(modeDir, entityId, 'meta.json')) || {};
          return {
            id: meta.id || entityId,
            name: meta.name || entityId,
            role: meta.role || '',
            kind: meta.kind || mode,
            confidence: meta.confidence_score || 0,
            trend: meta.trend || 'neutral'
          };
        });
    }

    function readLegacyInterviewEntities() {
      const interviewsDir = path.join(appPath, 'Interviews');
      if (!fs.existsSync(interviewsDir)) {
        return [];
      }

      return fs.readdirSync(interviewsDir, { withFileTypes: true })
        .filter((item) => item.isDirectory())
        .map((item) => {
          const meta = readJsonFile(path.join(interviewsDir, item.name, 'meta.json')) || {};
          return {
            id: item.name,
            name: meta.name || item.name,
            role: meta.role || '',
            kind: 'interview',
            confidence: meta.confidence_score || 0,
            trend: meta.trend || 'neutral'
          };
        });
    }

  function readLegacyInterviewSessions(entityId) {
    const interviewsDir = path.join(appPath, 'Interviews');
    if (!fs.existsSync(interviewsDir)) {
      return [];
    }

    const entityDirs = entityId
      ? [path.join(interviewsDir, entityId)]
      : fs.readdirSync(interviewsDir, { withFileTypes: true })
        .filter((item) => item.isDirectory())
        .map((item) => path.join(interviewsDir, item.name));

    const sessions = [];
    for (const entityDir of entityDirs) {
      if (!fs.existsSync(entityDir)) {
        continue;
      }

      const meta = readJsonFile(path.join(entityDir, 'meta.json')) || {};
      const files = fs.readdirSync(entityDir).filter((file) => file.endsWith('.json') && file !== 'meta.json');
      for (const file of files) {
        const legacy = readJsonFile(path.join(entityDir, file));
        if (!legacy) {
          continue;
        }

        sessions.push(normalizeSessionRecord({
          id: legacy.id,
          mode: 'interview',
          entity: {
            id: path.basename(entityDir),
            name: legacy.company || meta.name || path.basename(entityDir),
            role: legacy.role || meta.role || ''
          },
          title: legacy.phase || 'Interview',
          phase: legacy.phase || '',
          attendees: legacy.interviewerName ? [{
            name: legacy.interviewerName,
            role: legacy.interviewerTitle || ''
          }] : [],
          date: legacy.date,
          transcript: legacy.transcript || [],
          notes: {
            summary: legacy.reasoning || '',
            actionItems: legacy.examples || []
          },
          cards: [],
          grading: {
            status: legacy.gradingStatus || 'pending',
            grade: legacy.grade || null,
            reasoning: legacy.reasoning || '',
            examples: legacy.examples || []
          },
          source: 'legacy-interview'
        }));
      }
    }

    return sessions;
  }

  function findSessionFiles(mode, id) {
    const modeDir = path.join(sessionsDir, mode);
    if (!fs.existsSync(modeDir)) {
      return [];
    }

    return fs.readdirSync(modeDir, { withFileTypes: true })
      .filter((item) => item.isDirectory())
      .map((item) => path.join(modeDir, item.name, `${id}.json`));
  }

    return {
      deleteSession,
      deleteEntity,
      getSessionEntities,
      getSessions,
      saveSession,
      updateEntityConfidence
    };
}

function normalizeSessionRecord(record = {}) {
  const mode = normalizeMode(record.mode);
  const entity = record.entity && typeof record.entity === 'object' ? record.entity : {};
  const entityName = clean(entity.name || record.company || record.title || 'General');
  const entityId = sanitizeId(entity.id || entityName || 'general');

  return {
    id: clean(record.id) || Date.now().toString(),
    mode,
    entity: {
      id: entityId,
      name: entityName || entityId,
      role: clean(entity.role || record.role),
      kind: clean(entity.kind || mode)
    },
    title: clean(record.title || record.phase || (mode === 'interview' ? 'Interview session' : 'Meeting session')),
    phase: clean(record.phase),
    attendees: Array.isArray(record.attendees) ? record.attendees.map(normalizeAttendee).filter(Boolean) : [],
    date: clean(record.date) || new Date().toISOString(),
    transcript: Array.isArray(record.transcript) ? record.transcript.map(normalizeTurn).filter(Boolean) : [],
    notes: normalizeNotes(record.notes),
    cards: Array.isArray(record.cards) ? record.cards.map(normalizeCard).filter(Boolean) : [],
    grading: record.grading || null,
    source: clean(record.source || 'native')
  };
}

function normalizeAttendee(attendee = {}) {
  const name = clean(attendee.name);
  if (!name) {
    return null;
  }

  return {
    name,
    role: clean(attendee.role)
  };
}

function normalizeTurn(turn = {}) {
  const text = clean(turn.text);
  if (!text) {
    return null;
  }

  return {
    speaker: clean(turn.speaker || 'Unknown'),
    text,
    speakerColor: clean(turn.speakerColor)
  };
}

function normalizeCard(card = {}) {
  const type = clean(card.type || 'note');
  const body = clean(card.body || card.text);
  const question = clean(card.question);
  const bullets = Array.isArray(card.bullets) ? card.bullets.map(clean).filter(Boolean) : [];

  if (!body && !question && bullets.length === 0) {
    return null;
  }

  return {
    id: clean(card.id) || `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    title: clean(card.title || type),
    body,
    question,
    bullets,
    detail: clean(card.detail)
  };
}

function normalizeNotes(notes = {}) {
  return {
    summary: clean(notes.summary),
    actionItems: Array.isArray(notes.actionItems) ? notes.actionItems.map(clean).filter(Boolean) : []
  };
}

function dedupeSessions(sessions) {
  const seen = new Set();
  const result = [];

  for (const session of sessions) {
    const key = `${session.mode}:${session.entity.id}:${session.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(session);
    }
  }

  return result;
}

function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_error) {
    return null;
  }
}

function normalizeMode(mode) {
  return mode === 'meeting' ? 'meeting' : 'interview';
}

function sanitizeId(value) {
  return clean(value).replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'general';
}

function clean(value) {
  return String(value || '').trim();
}

module.exports = {
  createSessionManager,
  normalizeSessionRecord,
  sanitizeId
};
