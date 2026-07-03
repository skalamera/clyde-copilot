const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const pdfParse = require('pdf-parse');
const defaultPineconeClient = require('./pineconeClient');

const DEFAULT_MAX_FILE_BYTES = 25 * 1024 * 1024;
const DEFAULT_CHUNK_CHARS = 1400;
const SUPPORTED_UPLOAD_EXTENSIONS = new Set(['.txt', '.md', '.pdf']);

function createKnowledgeManager(options = {}) {
  const appPath = options.appPath;
  if (!appPath) {
    throw new Error('appPath is required.');
  }

  const logger = options.logger || console;
  const DatabaseImpl = options.Database || Database;
  const parsePdf = options.pdfParse || pdfParse;
  const pineconeClient = options.pineconeClient || defaultPineconeClient;
  const maxFileBytes = Number(options.maxFileBytes || DEFAULT_MAX_FILE_BYTES);
  const knowledgeDir = path.join(appPath, 'Knowledge');
  const dbPath = options.dbPath || path.join(knowledgeDir, 'knowledge.db');

  fs.mkdirSync(knowledgeDir, { recursive: true });

  const db = new DatabaseImpl(dbPath);
  db.pragma('journal_mode = WAL');
  db.prepare(`
    CREATE TABLE IF NOT EXISTS knowledge_base (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      file_path TEXT,
      content TEXT NOT NULL,
      type TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  const upsertStatement = db.prepare(`
    INSERT INTO knowledge_base (
      id,
      filename,
      file_path,
      content,
      type,
      metadata_json,
      created_at,
      updated_at
    ) VALUES (
      @id,
      @filename,
      @file_path,
      @content,
      @type,
      @metadata_json,
      @created_at,
      @updated_at
    )
    ON CONFLICT(id) DO UPDATE SET
      filename = excluded.filename,
      file_path = excluded.file_path,
      content = excluded.content,
      type = excluded.type,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `);

  const getStatement = db.prepare('SELECT * FROM knowledge_base WHERE id = ?');
  const deleteStatement = db.prepare('DELETE FROM knowledge_base WHERE id = ?');

    async function archiveSession(session = {}, settings = {}) {
      const content = buildSessionKnowledgeContent(session);
      if (!content) {
        return null;
      }

      const now = new Date().toISOString();
      const id = transcriptKnowledgeId(session);
        const metadata = {
          source: 'session',
          sessionId: clean(session.id),
          mode: normalizeMode(session.mode),
          title: clean(session.title || session.phase),
          entityId: clean(session.entity?.id || session.entity?.name || 'general'),
          entityName: clean(session.entity?.name || session.entity?.id || 'General'),
          date: clean(session.date)
        };

        const existing = getKnowledgeItem(id);

        let item = upsertKnowledgeItem({
          id,
          filename: sessionKnowledgeFilename(session),
          file_path: '',
          content,
          type: 'transcript',
          metadata: {
            ...metadata,
            ...(existing?.metadata || {})
          },
          now
        });

      try {
        const pinecone = await indexKnowledgeItem(item, settings);
        if (pinecone && pinecone.status !== 'error') {
          item = upsertKnowledgeItem({
            ...item,
            metadata: {
              ...parseMetadata(item.metadata_json),
              pinecone
            },
            now: new Date().toISOString()
          });
        }
      } catch (error) {
        logger.warn?.('Knowledge transcript indexing failed:', error);
      }

      return getKnowledgeItem(id);
    }

  async function ingestFile(filePath, settings = {}, context = {}) {
    const resolvedPath = path.resolve(String(filePath || ''));
    const extension = path.extname(resolvedPath).toLowerCase();

    if (!SUPPORTED_UPLOAD_EXTENSIONS.has(extension)) {
      throw new Error('Unsupported file type. Clyde Pro can ingest .txt, .md, and .pdf files.');
    }

    const stats = fs.statSync(resolvedPath);
    if (stats.size > maxFileBytes) {
      throw new Error('File is too large for local ingestion.');
    }

    const content = normalizeKnowledgeText(await readUploadContent(resolvedPath, extension, parsePdf));
    if (!content) {
      throw new Error('File did not contain readable text.');
    }

    const now = new Date().toISOString();
    const metadata = {
      source: 'upload',
      extension,
      sizeBytes: stats.size,
      mode: context.mode ? normalizeMode(context.mode) : '',
      entityId: context.entityId ? clean(context.entityId) : '',
      entityName: context.entityName ? clean(context.entityName) : '',
      ...(context.metadata || {})
    };
    const id = uploadKnowledgeId(resolvedPath, metadata);

    let item = upsertKnowledgeItem({
      id,
      filename: path.basename(resolvedPath),
      file_path: resolvedPath,
      content,
      type: 'upload',
      metadata,
      now
    });

    const pinecone = await indexKnowledgeItem(item, settings);
    if (pinecone) {
      item = upsertKnowledgeItem({
        ...item,
        metadata: {
          ...parseMetadata(item.metadata_json),
          pinecone
        },
        now: new Date().toISOString()
      });
    }

    return getKnowledgeItem(item.id);
  }

  function upsertKnowledgeItem(item = {}) {
    const existing = item.id ? getStatement.get(item.id) : null;
    const now = clean(item.now) || new Date().toISOString();
    const metadata = item.metadata || parseMetadata(item.metadata_json);
    const row = {
      id: clean(item.id),
      filename: clean(item.filename) || 'Knowledge item',
      file_path: clean(item.file_path || item.filePath),
      content: clean(item.content),
      type: clean(item.type) || 'upload',
      metadata_json: JSON.stringify(metadata || {}),
      created_at: existing?.created_at || clean(item.created_at) || now,
      updated_at: now
    };

    if (!row.id) {
      throw new Error('Knowledge item id is required.');
    }

    upsertStatement.run(row);
    return getKnowledgeItem(row.id);
  }

  async function indexKnowledgeItem(item, settings = {}) {
    if (!pineconeClient || typeof pineconeClient.upsertKnowledgeChunks !== 'function') {
      return null;
    }

    const chunks = chunkContent(item.content);
    if (!chunks.length) {
      return null;
    }

    try {
      const result = await pineconeClient.upsertKnowledgeChunks({
        knowledgeItem: {
          ...item,
          metadata: parseMetadata(item.metadata_json)
        },
        chunks,
        settings
      });

      if (!result || result.ok === false) {
        return {
          status: 'skipped',
          reason: result?.skipped || result?.message || 'not-indexed'
        };
      }

      return {
        status: 'indexed',
        count: Number(result.count || result.upsertedCount || chunks.length) || chunks.length
      };
    } catch (error) {
      return {
        status: 'error',
        message: formatPineconeError(error)
      };
    }
  }

  function listKnowledge(filters = {}) {
    const values = [];
    const where = [];
    const type = clean(filters.type);
    const query = clean(filters.query);
    const mode = clean(filters.mode);
    const entityId = clean(filters.entityId);

    if (type) {
      where.push('type = ?');
      values.push(type);
    }

    if (query) {
      where.push('(filename LIKE ? OR content LIKE ?)');
      values.push(`%${query}%`, `%${query}%`);
    }

    const sql = [
      'SELECT * FROM knowledge_base',
      where.length ? `WHERE ${where.join(' AND ')}` : '',
      'ORDER BY datetime(updated_at) DESC'
    ].filter(Boolean).join(' ');

    return db.prepare(sql).all(...values)
      .map(withParsedMetadata)
      .filter((item) => {
        if (mode && item.metadata?.mode !== mode) {
          return false;
        }
        if (entityId && item.metadata?.entityId !== entityId) {
          return false;
        }
        return true;
      });
  }

  function getKnowledgeItem(id) {
    const row = getStatement.get(id);
    return row ? withParsedMetadata(row) : null;
  }

    async function uploadToPinecone(id, settings = {}) {
      const item = getKnowledgeItem(id);
      if (!item) {
        throw new Error('Knowledge item not found.');
      }

      const pinecone = await indexKnowledgeItem(item, settings);
      if (pinecone && pinecone.status !== 'error') {
        const updatedItem = upsertKnowledgeItem({
          ...item,
          metadata: {
            ...parseMetadata(item.metadata_json),
            pinecone
          },
          now: new Date().toISOString()
        });
        return updatedItem;
      }
      
      throw new Error(pinecone?.reason || pinecone?.message || 'Failed to index item in Pinecone.');
    }

    async function deleteKnowledgeItem(id, settings = {}) {
        const item = getKnowledgeItem(id);
        if (item && item.metadata?.pinecone && typeof pineconeClient?.deleteKnowledgeVectors === 'function') {
          try {
            logger.log?.(`[Pinecone] Initiating deletion of vectors for knowledge item: ${item.id}`);
            const result = await pineconeClient.deleteKnowledgeVectors(item.id, settings);
            if (result && result.ok !== false) {
              logger.log?.(`[Pinecone] Successfully deleted vectors for knowledge item: ${item.id}`);
            } else {
              logger.warn?.(`[Pinecone] Deletion skipped or failed for ${item.id}:`, result?.skipped || result?.message || 'Unknown reason');
            }
          } catch (error) {
            logger.warn?.(`[Pinecone] Failed to delete pinecone vectors for ${item.id}:`, error);
          }
        } else {
          logger.log?.(`[Pinecone] Skipping remote deletion for ${id} (no pinecone metadata or missing client)`);
        }

        deleteStatement.run(id);
        logger.log?.(`[Knowledge] Deleted local item: ${id}`);
        return true;
      }

  function getPinnedKnowledge(ids = []) {
    const pinnedIds = Array.isArray(ids) ? ids.slice(0, 3) : [];
    return pinnedIds.map(getKnowledgeItem).filter(Boolean);
  }

  function listEntityKnowledge({ mode, entityId, query = '' } = {}) {
    return listKnowledge({
      mode: normalizeMode(mode),
      entityId: clean(entityId),
      query,
      type: 'upload'
    });
  }

  function close() {
    db.close();
  }

  return {
    archiveSession,
    chunkContent,
    close,
    dbPath,
    deleteKnowledgeItem,
      getKnowledgeItem,
      getPinnedKnowledge,
      ingestFile,
      listEntityKnowledge,
      listKnowledge,
      uploadToPinecone,
      upsertKnowledgeItem
  };
}

function transcriptKnowledgeId(session = {}) {
  const mode = normalizeMode(session.mode);
  const entityId = clean(session.entity?.id || session.entity?.name || 'general') || 'general';
  const sessionId = clean(session.id) || stableHash(JSON.stringify(session)).slice(0, 16);
  return `session:${mode}:${entityId}:${sessionId}`;
}

function uploadKnowledgeId(filePath, metadata = {}) {
  const entityPart = metadata?.entityId
    ? `${normalizeMode(metadata.mode)}:${clean(metadata.entityId)}:`
    : '';
  return `upload:${entityPart}${stableHash(path.resolve(filePath))}`;
}

function sessionKnowledgeFilename(session = {}) {
  const date = clean(session.date).slice(0, 10);
  const title = clean(session.title || session.phase || session.entity?.name || 'session');
  return `${[date, title].filter(Boolean).join(' ')}.txt`;
}

function buildSessionKnowledgeContent(session = {}) {
  const transcript = Array.isArray(session.transcript)
    ? session.transcript
      .map((turn) => {
        const speaker = clean(turn.speaker || 'Unknown');
        const text = clean(turn.text);
        return text ? `${speaker}: ${text}` : '';
      })
      .filter(Boolean)
      .join('\n')
    : '';
  const summary = clean(session.notes?.summary);
  const actionItems = flattenActionItems(session.notes?.actionItems);

  return [
    transcript,
    summary ? `Summary:\n${summary}` : '',
    actionItems.length ? `Action items:\n${actionItems.map((item) => `- ${item}`).join('\n')}` : ''
  ].filter(Boolean).join('\n\n').trim();
}

function flattenActionItems(actionItems = []) {
  if (!Array.isArray(actionItems)) {
    return [];
  }

  return actionItems.flatMap((item) => {
    if (!item) {
      return [];
    }

    if (typeof item === 'string') {
      return [clean(item)].filter(Boolean);
    }

    if (Array.isArray(item.items)) {
      return item.items.map(clean).filter(Boolean);
    }

    return [clean(item.text || item.body || item.action)].filter(Boolean);
  });
}

async function readUploadContent(filePath, extension, parsePdf) {
  if (extension === '.pdf') {
    const buffer = fs.readFileSync(filePath);
    const result = await parsePdf(buffer);
    return result?.text || '';
  }

  return fs.readFileSync(filePath, 'utf8');
}

function chunkContent(content, chunkChars = DEFAULT_CHUNK_CHARS) {
  const cleanContent = normalizeKnowledgeText(content);
  if (!cleanContent) {
    return [];
  }

  const paragraphs = cleanContent.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if (!current) {
      current = paragraph;
      continue;
    }

    if (`${current}\n\n${paragraph}`.length <= chunkChars) {
      current = `${current}\n\n${paragraph}`;
      continue;
    }

    chunks.push(...splitLongText(current, chunkChars));
    current = paragraph;
  }

  if (current) {
    chunks.push(...splitLongText(current, chunkChars));
  }

  return chunks.map((chunk) => chunk.trim()).filter(Boolean);
}

function splitLongText(text, chunkChars) {
  if (text.length <= chunkChars) {
    return [text];
  }

  const chunks = [];
  let remaining = text;

  while (remaining.length > chunkChars) {
    const boundary = Math.max(
      remaining.lastIndexOf('\n', chunkChars),
      remaining.lastIndexOf('. ', chunkChars),
      remaining.lastIndexOf(' ', chunkChars)
    );
    const splitAt = boundary > Math.floor(chunkChars * 0.5) ? boundary + 1 : chunkChars;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
}

function normalizeKnowledgeText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function withParsedMetadata(row) {
  return {
    ...row,
    metadata: parseMetadata(row.metadata_json)
  };
}

function parseMetadata(value) {
  if (!value || typeof value === 'object') {
    return value || {};
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return {};
  }
}

function formatPineconeError(error) {
  const baseMessage = clean(error?.message || 'Pinecone request failed');
  const status = Number(error?.response?.status || 0);
  const body = error?.response?.data;

  if (!status && body === undefined) {
    return baseMessage;
  }

  let bodyText = '';
  if (typeof body === 'string') {
    bodyText = body.trim();
  } else if (body !== undefined) {
    try {
      bodyText = JSON.stringify(body);
    } catch (_error) {
      bodyText = String(body);
    }
  }

  const parts = [baseMessage];
  if (status) {
    parts.push(`status=${status}`);
  }
  if (bodyText) {
    parts.push(`body=${bodyText}`);
  }
  return parts.join(' | ');
}

function normalizeMode(mode) {
  return mode === 'meeting' ? 'meeting' : 'interview';
}

function stableHash(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex');
}

function clean(value) {
  return String(value || '').trim();
}

module.exports = {
  chunkContent,
  createKnowledgeManager,
  formatPineconeError,
  transcriptKnowledgeId,
  uploadKnowledgeId
};
