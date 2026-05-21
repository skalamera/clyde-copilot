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
