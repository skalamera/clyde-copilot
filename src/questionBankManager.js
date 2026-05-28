const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const defaultPineconeClient = require('./pineconeClient');

function createQuestionBankManager(options = {}) {
  const appPath = options.appPath;
  if (!appPath) {
    throw new Error('appPath is required.');
  }

  const DatabaseImpl = options.Database || Database;
  const pineconeClient = options.pineconeClient || defaultPineconeClient;
  const logger = options.logger || console;
  const dataDir = path.join(appPath, 'QuestionBank');
  const dbPath = options.dbPath || path.join(dataDir, 'question-bank.db');

  fs.mkdirSync(dataDir, { recursive: true });

  const db = new DatabaseImpl(dbPath);
  db.pragma('journal_mode = WAL');
  db.prepare(`
    CREATE TABLE IF NOT EXISTS question_bank (
      id TEXT PRIMARY KEY,
      question TEXT NOT NULL,
      sample_answer TEXT NOT NULL,
      scope_mode TEXT NOT NULL DEFAULT 'global',
      entity_id TEXT,
      entity_name TEXT,
      mode TEXT NOT NULL DEFAULT 'interview',
      source TEXT NOT NULL DEFAULT 'manual',
      answer_source TEXT NOT NULL DEFAULT 'candidate',
      tags_json TEXT NOT NULL DEFAULT '[]',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      normalized_key TEXT NOT NULL UNIQUE
    )
  `).run();

  const upsertStatement = db.prepare(`
    INSERT INTO question_bank (
      id, question, sample_answer, scope_mode, entity_id, entity_name, mode,
      source, answer_source, tags_json, metadata_json, created_at, updated_at, normalized_key
    ) VALUES (
      @id, @question, @sample_answer, @scope_mode, @entity_id, @entity_name, @mode,
      @source, @answer_source, @tags_json, @metadata_json, @created_at, @updated_at, @normalized_key
    )
    ON CONFLICT(normalized_key) DO UPDATE SET
      question = excluded.question,
      sample_answer = excluded.sample_answer,
      scope_mode = excluded.scope_mode,
      entity_id = excluded.entity_id,
      entity_name = excluded.entity_name,
      mode = excluded.mode,
      source = excluded.source,
      answer_source = excluded.answer_source,
      tags_json = excluded.tags_json,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `);
  const getByKeyStatement = db.prepare('SELECT * FROM question_bank WHERE normalized_key = ?');
  const getByIdStatement = db.prepare('SELECT * FROM question_bank WHERE id = ?');
  const deleteStatement = db.prepare('DELETE FROM question_bank WHERE id = ?');
  const updateEntryStatement = db.prepare(`
    UPDATE question_bank SET
      question = @question,
      sample_answer = @sample_answer,
      scope_mode = @scope_mode,
      entity_id = @entity_id,
      entity_name = @entity_name,
      mode = @mode,
      source = @source,
      answer_source = @answer_source,
      tags_json = @tags_json,
      metadata_json = @metadata_json,
      updated_at = @updated_at,
      normalized_key = @normalized_key
    WHERE id = @id
  `);
  const updateBulkStatement = db.prepare(`
    UPDATE question_bank SET
      scope_mode = @scope_mode,
      entity_id = @entity_id,
      entity_name = @entity_name,
      source = @source,
      updated_at = @updated_at,
      normalized_key = @normalized_key
    WHERE id = @id
  `);

  async function upsertEntry(entry = {}, settings = {}) {
    const question = clean(entry.question);
    const sampleAnswer = clean(entry.sampleAnswer || entry.sample_answer || entry.answer);
    if (!question || !sampleAnswer) {
      return null;
    }

    const mode = normalizeMode(entry.mode);
    const entityId = clean(entry.entityId || entry.entity_id);
    const entityName = clean(entry.entityName || entry.entity_name || entityId);
    const scopeMode = entityId ? 'entity' : 'global';
    const normalizedKey = buildNormalizedKey({ question, mode, entityId });
    const existingById = entry.id ? getByIdStatement.get(clean(entry.id)) : null;
    const existing = existingById || getByKeyStatement.get(normalizedKey);
    const now = new Date().toISOString();
    const row = {
      id: existing?.id || entry.id || `qb_${hash(normalizedKey).slice(0, 24)}`,
      question,
      sample_answer: sampleAnswer,
      scope_mode: scopeMode,
      entity_id: entityId || null,
      entity_name: entityName || null,
      mode,
      source: normalizeSource(entry.source),
      answer_source: normalizeAnswerSource(entry.answerSource || entry.answer_source),
      tags_json: JSON.stringify(Array.isArray(entry.tags) ? entry.tags.map(clean).filter(Boolean).slice(0, 12) : []),
      metadata_json: JSON.stringify(entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : {}),
      created_at: existing?.created_at || entry.createdAt || now,
      updated_at: now,
      normalized_key: normalizedKey
    };

    if (existingById) {
      updateEntryStatement.run(row);
    } else {
      upsertStatement.run(row);
    }
    const saved = mapRow(getByIdStatement.get(row.id));
    indexEntry(saved, settings).catch((error) => logger.warn?.('Question bank Pinecone index failed:', error));
    return saved;
  }

  function listEntries(filters = {}) {
    const where = [];
    const params = {};
    if (filters.mode) {
      where.push('mode = @mode');
      params.mode = normalizeMode(filters.mode);
    }
    if (filters.entityId) {
      where.push('entity_id = @entityId');
      params.entityId = clean(filters.entityId);
    }
    if (filters.scopeMode === 'global') {
      where.push('scope_mode = @scopeMode');
      params.scopeMode = 'global';
    }
    if (filters.source) {
      where.push('source = @source');
      params.source = normalizeSource(filters.source);
    }
    if (filters.query) {
      where.push('(question LIKE @query OR sample_answer LIKE @query OR entity_name LIKE @query)');
      params.query = `%${clean(filters.query)}%`;
    }

    const sql = `SELECT * FROM question_bank ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY updated_at DESC LIMIT @limit`;
    return db.prepare(sql).all({ ...params, limit: Math.min(Number(filters.limit || 250), 1000) }).map(mapRow);
  }

  function listContextEntries({ mode = 'interview', entityId = '', tier = 'free', limit = 24, includeGlobal = false, allQuestionBank = false } = {}) {
    const normalizedMode = normalizeMode(mode);
    const activeEntityId = clean(entityId);
    const shouldIncludeGlobal = Boolean(includeGlobal || allQuestionBank);
    const rows = tier === 'pro' && shouldIncludeGlobal
      ? db.prepare(`
          SELECT * FROM question_bank
          WHERE mode = @mode AND (scope_mode = 'global' OR entity_id = @entityId OR @entityId = '')
          ORDER BY CASE WHEN entity_id = @entityId THEN 0 WHEN scope_mode = 'global' THEN 1 ELSE 2 END, updated_at DESC
          LIMIT @limit
        `).all({ mode: normalizedMode, entityId: activeEntityId, limit: Math.min(Number(limit || 24), 80) })
      : db.prepare(`
          SELECT * FROM question_bank
          WHERE mode = @mode AND entity_id = @entityId
          ORDER BY updated_at DESC
          LIMIT @limit
        `).all({ mode: normalizedMode, entityId: activeEntityId, limit: Math.min(Number(limit || 24), 80) });
    return rows.map(mapRow);
  }

  function buildContext(options = {}) {
    const entries = listContextEntries(options);
    if (!entries.length) {
      return '';
    }
    return [
      'Question bank entries:',
      ...entries.map((entry) => [
        `Q: ${entry.question}`,
        `A: ${entry.sampleAnswer}`,
        entry.entityName ? `Linked to: ${entry.entityName}` : 'Linked to: Global'
      ].join('\n'))
    ].join('\n\n');
  }

  function getDashboard(filters = {}) {
    const entries = listEntries({ ...filters, limit: 1000 });
    const sourceCounts = countBy(entries, (entry) => entry.source || 'manual');
    const topEntities = countBy(entries.filter((entry) => entry.entityName), (entry) => entry.entityName).slice(0, 8);
    const keywords = countKeywords(entries);
    const themes = countBy(entries.flatMap((entry) => entry.tags || []), (tag) => tag).slice(0, 12);
    return {
      total: entries.length,
      global: entries.filter((entry) => entry.scopeMode === 'global').length,
      linked: entries.filter((entry) => entry.scopeMode === 'entity').length,
      sourceCounts,
      topEntities,
      keywords,
      themes,
      commonQuestions: entries.slice(0, 8).map((entry) => ({
        question: entry.question,
        entityName: entry.entityName,
        source: entry.source
      }))
    };
  }

  async function importCsvText(csvText = '', options = {}, settings = {}) {
    const rows = parseCsv(csvText);
    const header = rows.shift()?.map((cell) => clean(cell).toLowerCase()) || [];
    const saved = [];
    for (const row of rows) {
      const record = rowToRecord(header, row);
      const question = record.question || record.q;
      const answer = record.sample_answer || record.sampleanswer || record.answer || record.a;
      if (!question || !answer) {
        continue;
      }
      const entityName = record.opportunity || record.meeting || record.entity || record.linked_opportunity || '';
      saved.push(await upsertEntry({
        question,
        sampleAnswer: answer,
        entityId: clean(record.entity_id || entityName),
        entityName,
        mode: options.mode || record.mode || 'interview',
        source: 'csv',
        answerSource: 'candidate',
        tags: splitTags(record.tags)
      }, settings));
    }
    return saved.filter(Boolean);
  }

  async function extractFromInterviewSession(record = {}, entries = [], settings = {}) {
    const saved = [];
    for (const entry of entries) {
      const savedEntry = await upsertEntry({
        question: entry.question,
        sampleAnswer: entry.sampleAnswer || entry.sample_answer || entry.answer,
        entityId: record.entity?.id || record.entity?.name || '',
        entityName: record.entity?.name || record.entity?.id || '',
        mode: 'interview',
        source: 'clyde',
        answerSource: entry.answerSource || entry.answer_source || 'clyde_generated',
        tags: entry.tags || [],
        metadata: {
          sessionId: record.id || '',
          sessionTitle: record.title || record.phase || ''
        }
      }, settings);
      if (savedEntry) {
        saved.push(savedEntry);
      }
    }
    return saved;
  }

  function deleteEntry(id) {
    return deleteStatement.run(clean(id)).changes > 0;
  }

  function deleteEntries(ids = []) {
    const uniqueIds = Array.from(new Set((Array.isArray(ids) ? ids : []).map(clean).filter(Boolean)));
    let deleted = 0;
    for (const id of uniqueIds) {
      deleted += deleteEntry(id) ? 1 : 0;
    }
    return deleted;
  }

  async function bulkUpdateEntries(payload = {}, settings = {}) {
    const ids = Array.from(new Set((Array.isArray(payload.ids) ? payload.ids : []).map(clean).filter(Boolean)));
    const patch = payload.patch && typeof payload.patch === 'object' ? payload.patch : {};
    const hasEntityPatch = Object.prototype.hasOwnProperty.call(patch, 'entityId') || Object.prototype.hasOwnProperty.call(patch, 'entityName');
    const hasSourcePatch = Object.prototype.hasOwnProperty.call(patch, 'source');
    const saved = [];

    for (const id of ids) {
      const current = mapRow(getByIdStatement.get(id));
      if (!current) {
        continue;
      }
      const nextEntityId = hasEntityPatch ? clean(patch.entityId) : current.entityId;
      const nextEntityName = hasEntityPatch ? clean(patch.entityName || nextEntityId) : current.entityName;
      const nextSource = hasSourcePatch ? normalizeSource(patch.source) : current.source;
      updateBulkStatement.run({
        id: current.id,
        scope_mode: nextEntityId ? 'entity' : 'global',
        entity_id: nextEntityId || null,
        entity_name: nextEntityName || null,
        source: nextSource,
        updated_at: new Date().toISOString(),
        normalized_key: buildNormalizedKey({ question: current.question, mode: current.mode, entityId: nextEntityId })
      });
      const updated = mapRow(getByIdStatement.get(current.id));
      if (updated) {
        saved.push(updated);
        indexEntry(updated, settings).catch((error) => logger.warn?.('Question bank Pinecone index failed:', error));
      }
    }

    return saved;
  }

  async function indexEntry(entry, settings = {}) {
    if (!entry || settings.userTier !== 'pro' || !settings.ragEnabled) {
      return null;
    }
    const content = `Question: ${entry.question}\nSample answer: ${entry.sampleAnswer}`;
    return pineconeClient.upsertKnowledgeChunks({
      knowledgeItem: {
        id: entry.id,
        filename: `Question bank - ${entry.entityName || 'Global'}`,
        type: 'question_bank',
        metadata: {
          source: 'question_bank',
          mode: entry.mode,
          entityId: entry.entityId || '',
          entityName: entry.entityName || '',
          scopeMode: entry.scopeMode
        }
      },
      chunks: [content],
      settings
    });
  }

  return {
    buildContext,
    bulkUpdateEntries,
    deleteEntry,
    deleteEntries,
    extractFromInterviewSession,
    getDashboard,
    importCsvText,
    listContextEntries,
    listEntries,
    upsertEntry
  };
}

function mapRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    question: row.question,
    sampleAnswer: row.sample_answer,
    scopeMode: row.scope_mode,
    entityId: row.entity_id || '',
    entityName: row.entity_name || '',
    mode: row.mode,
    source: row.source,
    answerSource: row.answer_source,
    tags: parseJson(row.tags_json, []),
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function buildNormalizedKey({ question, mode, entityId }) {
  return [normalizeMode(mode), clean(entityId).toLowerCase(), normalizeQuestion(question)].join('::');
}

function normalizeQuestion(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9\s?]/g, '').replace(/\s+/g, ' ').replace(/\?+$/, '').trim();
}

function parseCsv(text = '') {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const input = String(text || '');
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (quoted && char === '"' && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === ',') {
      row.push(cell);
      cell = '';
    } else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => clean(value))) {
        rows.push(row);
      }
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => clean(value))) {
    rows.push(row);
  }
  return rows;
}

function rowToRecord(header = [], row = []) {
  const record = {};
  header.forEach((key, index) => {
    if (key) {
      record[key.replace(/\s+/g, '_')] = clean(row[index]);
    }
  });
  return record;
}

function countBy(entries, getKey) {
  const counts = new Map();
  entries.forEach((entry) => {
    const key = clean(getKey(entry));
    if (key) {
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  });
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function countKeywords(entries = []) {
  const stop = new Set(['about', 'after', 'before', 'could', 'should', 'their', 'there', 'these', 'those', 'what', 'when', 'where', 'which', 'with', 'would', 'your', 'have', 'that', 'this']);
  return countBy(entries.flatMap((entry) => clean(entry.question).toLowerCase().match(/[a-z]{4,}/g) || []).filter((word) => !stop.has(word)), (word) => word).slice(0, 12);
}

function splitTags(value = '') {
  return clean(value).split(/[;,]/).map(clean).filter(Boolean);
}

function parseJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch (_error) {
    return fallback;
  }
}

function normalizeMode(mode) {
  return mode === 'meeting' ? 'meeting' : 'interview';
}

function normalizeSource(source) {
  const value = clean(source).toLowerCase();
  return ['manual', 'csv', 'clyde'].includes(value) ? value : 'manual';
}

function normalizeAnswerSource(source) {
  const value = clean(source).toLowerCase();
  return value === 'candidate' ? 'candidate' : 'clyde_generated';
}

function hash(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function clean(value) {
  return String(value || '').trim();
}

module.exports = {
  createQuestionBankManager,
  parseCsv
};
