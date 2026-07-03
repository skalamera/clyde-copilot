const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createKnowledgeManager, transcriptKnowledgeId } = require('../src/knowledgeManager');

test('knowledge manager creates sqlite storage and archives sessions idempotently', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clyde-knowledge-'));
  const manager = createKnowledgeManager({ appPath: tempDir });

  test.after(() => {
    manager.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const session = {
    id: 'abc123',
    mode: 'meeting',
    entity: { id: 'platform-weekly', name: 'Platform weekly' },
    title: 'Platform sync',
    date: '2026-05-18T14:00:00.000Z',
    transcript: [
      { speaker: 'Morgan', text: 'We are moving billing to Lambda.' },
      { speaker: 'You', text: 'I can write the migration notes.' }
    ],
    notes: { summary: 'Billing migration discussed.', actionItems: [] }
  };

  const first = await manager.archiveSession(session);
  const second = await manager.archiveSession({
    ...session,
    notes: { summary: 'Updated summary.', actionItems: [] }
  });
  const rows = manager.listKnowledge({ type: 'transcript' });

  assert.equal(first.id, transcriptKnowledgeId(session));
  assert.equal(second.id, first.id);
  assert.equal(rows.length, 1);
  assert.match(rows[0].content, /Morgan: We are moving billing to Lambda\./);
  assert.match(rows[0].content, /Updated summary\./);
  assert.equal(fs.existsSync(path.join(tempDir, 'Knowledge', 'knowledge.db')), true);
});

test('knowledge manager ingests txt and markdown files and stores pinecone metadata', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clyde-knowledge-files-'));
  const txtPath = path.join(tempDir, 'research.txt');
  const mdPath = path.join(tempDir, 'brief.md');
  fs.writeFileSync(txtPath, 'Customer asked about AWS Lambda.', 'utf8');
  fs.writeFileSync(mdPath, '# Brief\n\nPinned deployment notes.', 'utf8');
  const upserted = [];
  const manager = createKnowledgeManager({
    appPath: tempDir,
    pineconeClient: {
      upsertKnowledgeChunks: async ({ knowledgeItem, chunks }) => {
        upserted.push({ knowledgeItem, chunks });
        return { ok: true, count: chunks.length };
      }
    }
  });

  test.after(() => {
    manager.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const txt = await manager.ingestFile(txtPath, { userTier: 'pro', ragEnabled: true });
  const md = await manager.ingestFile(mdPath, { userTier: 'pro', ragEnabled: true });
  const rows = manager.listKnowledge({ type: 'upload' });

  assert.equal(rows.length, 2);
  assert.equal(txt.filename, 'research.txt');
  assert.equal(md.filename, 'brief.md');
  assert.match(rows.map((row) => row.content).join('\n'), /Pinned deployment notes\./);
  assert.equal(upserted.length, 2);
  assert.equal(JSON.parse(manager.getKnowledgeItem(txt.id).metadata_json).pinecone.status, 'indexed');
});

test('knowledge manager rejects unsupported and oversized files', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clyde-knowledge-reject-'));
  const exePath = path.join(tempDir, 'malware.exe');
  const largePath = path.join(tempDir, 'large.txt');
  fs.writeFileSync(exePath, 'nope', 'utf8');
  fs.writeFileSync(largePath, 'x'.repeat(32), 'utf8');
  const manager = createKnowledgeManager({ appPath: tempDir, maxFileBytes: 16 });

  test.after(() => {
    manager.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  await assert.rejects(() => manager.ingestFile(exePath, {}), /Unsupported file type/);
  await assert.rejects(() => manager.ingestFile(largePath, {}), /File is too large/);
});

test('knowledge manager stores and filters entity-scoped files', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clyde-knowledge-entity-'));
  const acmePath = path.join(tempDir, 'acme.txt');
  const meetingPath = path.join(tempDir, 'meeting.txt');
  fs.writeFileSync(acmePath, 'ACME interview notes.', 'utf8');
  fs.writeFileSync(meetingPath, 'Weekly meeting notes.', 'utf8');
  const manager = createKnowledgeManager({ appPath: tempDir });

  test.after(() => {
    manager.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const acme = await manager.ingestFile(acmePath, {}, { mode: 'interview', entityId: 'acme', entityName: 'ACME' });
  await manager.ingestFile(meetingPath, {}, { mode: 'meeting', entityId: 'weekly', entityName: 'Weekly' });
  const rows = manager.listEntityKnowledge({ mode: 'interview', entityId: 'acme' });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, acme.id);
  assert.equal(rows[0].metadata.entityName, 'ACME');
  assert.match(rows[0].content, /ACME interview notes/);
});

test('uploadToPinecone surfaces Pinecone response body when upsert fails', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clyde-knowledge-pinecone-error-'));
  const txtPath = path.join(tempDir, 'ops.txt');
  fs.writeFileSync(txtPath, 'Operational notes for incident review.', 'utf8');
  const manager = createKnowledgeManager({
    appPath: tempDir,
    pineconeClient: {
      upsertKnowledgeChunks: async () => {
        const error = new Error('Request failed with status code 400');
        error.response = {
          status: 400,
          data: { code: 'BadRequest', message: 'Vector dimension 1536 does not match index dimension 1024' }
        };
        throw error;
      }
    }
  });

  test.after(() => {
    manager.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const item = await manager.ingestFile(txtPath, { userTier: 'pro', ragEnabled: true });

  await assert.rejects(
    () => manager.uploadToPinecone(item.id, { userTier: 'pro', ragEnabled: true }),
    /status=400.*dimension 1536 does not match index dimension 1024/i
  );
});

test('deleteKnowledgeItem removes Pinecone vectors when indexed metadata exists', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clyde-knowledge-pinecone-delete-'));
  const deletedVectors = [];
  const manager = createKnowledgeManager({
    appPath: tempDir,
    pineconeClient: {
      deleteKnowledgeVectors: async (knowledgeId, settings) => {
        deletedVectors.push({ knowledgeId, settings });
        return { ok: true };
      }
    }
  });

  test.after(() => {
    manager.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  manager.upsertKnowledgeItem({
    id: 'mock-interview:apollo:practice-1',
    filename: 'mock interview.txt',
    file_path: '',
    content: 'Mock interview scorecard and transcript.',
    type: 'mock-interview',
    metadata: {
      pinecone: { status: 'indexed', count: 2 }
    }
  });

  const deleted = await manager.deleteKnowledgeItem('mock-interview:apollo:practice-1', {
    userTier: 'pro',
    pineconeApiKey: 'pc-key',
    pineconeHost: 'https://index.example'
  });

  assert.equal(deleted, true);
  assert.equal(manager.getKnowledgeItem('mock-interview:apollo:practice-1'), null);
  assert.deepEqual(deletedVectors, [{
    knowledgeId: 'mock-interview:apollo:practice-1',
    settings: {
      userTier: 'pro',
      pineconeApiKey: 'pc-key',
      pineconeHost: 'https://index.example'
    }
  }]);
});
