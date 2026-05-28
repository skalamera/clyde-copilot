const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createQuestionBankManager, parseCsv } = require('../src/questionBankManager');
const {
  isQuestionBankWorthyQuestion,
  normalizeQuestionBankExtractionResponse
} = require('../src/questionBankExtraction');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'clyde-qb-'));
}

class FakeDatabase {
  constructor() {
    this.rows = [];
  }
  pragma() {}
  prepare(sql) {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    return {
      run: (params) => {
        if (/CREATE TABLE/i.test(normalized)) {
          return { changes: 0 };
        }
        if (/INSERT INTO question_bank/i.test(normalized)) {
          const index = this.rows.findIndex((row) => row.normalized_key === params.normalized_key);
          if (index >= 0) {
            this.rows[index] = { ...this.rows[index], ...params, id: this.rows[index].id, created_at: this.rows[index].created_at };
          } else {
            this.rows.push({ ...params });
          }
          return { changes: 1 };
        }
        if (/DELETE FROM question_bank/i.test(normalized)) {
          const before = this.rows.length;
          this.rows = this.rows.filter((row) => row.id !== params);
          return { changes: before - this.rows.length };
        }
        if (/UPDATE question_bank SET/i.test(normalized)) {
          const index = this.rows.findIndex((row) => row.id === params.id);
          if (index < 0) {
            return { changes: 0 };
          }
          this.rows[index] = { ...this.rows[index], ...params };
          return { changes: 1 };
        }
        return { changes: 0 };
      },
      get: (param) => {
        if (/WHERE normalized_key = \?/i.test(normalized)) {
          return this.rows.find((row) => row.normalized_key === param);
        }
        if (/WHERE id = \?/i.test(normalized)) {
          return this.rows.find((row) => row.id === param);
        }
        return null;
      },
      all: (params = {}) => this.rows.filter((row) => {
        if (params.mode && row.mode !== params.mode) return false;
        if (params.entityId && row.entity_id !== params.entityId && !/@entityId = ''/.test(normalized)) return false;
        if (params.scopeMode && row.scope_mode !== params.scopeMode) return false;
        if (params.source && row.source !== params.source) return false;
        if (params.query) {
          const query = params.query.replace(/%/g, '').toLowerCase();
          const text = `${row.question} ${row.sample_answer} ${row.entity_name || ''}`.toLowerCase();
          if (!text.includes(query)) return false;
        }
        return true;
      }).slice(0, params.limit || 1000)
    };
  }
}

test('question bank upserts and deduplicates by normalized question and entity', async () => {
  const manager = createQuestionBankManager({ appPath: tempDir(), Database: FakeDatabase });
  const first = await manager.upsertEntry({
    question: 'How do you handle escalations?',
    sampleAnswer: 'I triage impact, communicate status, and close the loop.',
    entityId: 'apollo',
    entityName: 'Apollo'
  });
  const second = await manager.upsertEntry({
    question: 'How do you handle escalations',
    sampleAnswer: 'I clarify severity, assign ownership, and follow up.',
    entityId: 'apollo',
    entityName: 'Apollo'
  });

  assert.equal(first.id, second.id);
  assert.equal(manager.listEntries({ entityId: 'apollo' }).length, 1);
  assert.match(manager.buildContext({ entityId: 'apollo', tier: 'free' }), /How do you handle escalations/);
});

test('question bank edits existing rows by id when the link changes', async () => {
  const manager = createQuestionBankManager({ appPath: tempDir(), Database: FakeDatabase });
  const first = await manager.upsertEntry({
    question: 'How do you handle escalations?',
    sampleAnswer: 'I triage impact, communicate status, and close the loop.'
  });
  const edited = await manager.upsertEntry({
    id: first.id,
    question: 'How do you handle escalations?',
    sampleAnswer: 'I clarify severity, assign ownership, and follow up.',
    entityId: 'apollo',
    entityName: 'Apollo',
    source: 'manual'
  });

  assert.equal(edited.id, first.id);
  assert.equal(edited.entityId, 'apollo');
  assert.equal(edited.sampleAnswer, 'I clarify severity, assign ownership, and follow up.');
  assert.equal(manager.listEntries({ mode: 'interview' }).length, 1);
});

test('question bank context entries use request options without global filters state', async () => {
  const manager = createQuestionBankManager({ appPath: tempDir(), Database: FakeDatabase });
  await manager.upsertEntry({
    question: 'How do you handle escalations?',
    sampleAnswer: 'I triage impact, communicate status, and close the loop.',
    entityId: 'apollo',
    entityName: 'Apollo'
  });
  await manager.upsertEntry({
    question: 'Tell me about yourself.',
    sampleAnswer: 'I summarize my background against the role.',
    scopeMode: 'global',
    entityId: '',
    entityName: ''
  });

  assert.doesNotThrow(() => manager.listContextEntries({
    mode: 'interview',
    entityId: 'apollo',
    tier: 'pro',
    includeGlobal: true
  }));
  assert.doesNotThrow(() => manager.buildContext({
    mode: 'interview',
    entityId: 'apollo',
    tier: 'pro',
    includeGlobal: true
  }));
});

test('question bank CSV import accepts question, answer, and opportunity columns', async () => {
  const manager = createQuestionBankManager({ appPath: tempDir(), Database: FakeDatabase });
  const saved = await manager.importCsvText('question,answer,opportunity\n"Tell me about a hard customer","I used clear ownership.",Apollo');

  assert.equal(saved.length, 1);
  assert.equal(saved[0].source, 'csv');
  assert.equal(saved[0].entityName, 'Apollo');
});

test('question bank bulk updates links and sources', async () => {
  const manager = createQuestionBankManager({ appPath: tempDir(), Database: FakeDatabase });
  const first = await manager.upsertEntry({
    question: 'How do you handle escalations?',
    sampleAnswer: 'I triage impact, communicate status, and close the loop.'
  });
  const second = await manager.upsertEntry({
    question: 'Tell me about yourself.',
    sampleAnswer: 'I summarize my background against the role.'
  });

  const linked = await manager.bulkUpdateEntries({
    ids: [first.id, second.id],
    patch: { entityId: 'apollo', entityName: 'Apollo' }
  });
  const sourced = await manager.bulkUpdateEntries({
    ids: [first.id],
    patch: { source: 'clyde' }
  });

  assert.equal(linked.length, 2);
  assert.equal(manager.listEntries({ entityId: 'apollo' }).length, 2);
  assert.equal(sourced[0].source, 'clyde');
  assert.equal(manager.deleteEntries([first.id, second.id]), 2);
  assert.equal(manager.listEntries({ mode: 'interview' }).length, 0);
});

test('question bank extraction keeps generated answers for weak candidate answers', () => {
  const entries = normalizeQuestionBankExtractionResponse(JSON.stringify({
    entries: [
      {
        question: 'Why this role?',
        sampleAnswer: 'This role matches my support operations background and process improvement work.',
        answerSource: 'clyde_generated',
        tags: ['motivation']
      }
    ]
  }));

  assert.equal(entries.length, 1);
  assert.equal(entries[0].answerSource, 'clyde_generated');
});

test('question bank extraction rejects setup and logistics checks', () => {
  const entries = normalizeQuestionBankExtractionResponse(JSON.stringify({
    entries: [
      {
        question: 'Can you see me?',
        sampleAnswer: 'Yes, I can see you clearly.',
        answerSource: 'candidate',
        tags: ['setup']
      },
      {
        question: 'How do you handle escalations?',
        sampleAnswer: 'I triage impact, communicate ownership, and close the loop.',
        answerSource: 'candidate',
        tags: ['support']
      }
    ]
  }));

  assert.equal(entries.length, 1);
  assert.equal(entries[0].question, 'How do you handle escalations?');
  assert.equal(isQuestionBankWorthyQuestion('Can you hear me?'), false);
  assert.equal(isQuestionBankWorthyQuestion('Are you still there?'), false);
  assert.equal(isQuestionBankWorthyQuestion('Does tomorrow still work?'), false);
  assert.equal(isQuestionBankWorthyQuestion('Good morning?'), false);
  assert.equal(isQuestionBankWorthyQuestion('Tell me about a time you improved a process.'), true);
});

test('CSV parser handles quoted commas', () => {
  assert.deepEqual(parseCsv('question,answer\n"Tell me, briefly","One, two"'), [
    ['question', 'answer'],
    ['Tell me, briefly', 'One, two']
  ]);
});
