const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { generateChat } = require('./llmClient');
const { sanitizeId } = require('./sessionManager');

const DEFAULT_OPENAI_MODEL = 'gpt-5.5';

function createMockInterviewManager(options = {}) {
  const appPath = options.appPath;
  if (!appPath) {
    throw new Error('appPath is required.');
  }

  const axiosClient = options.axiosClient;
  const knowledgeManager = options.knowledgeManager;
  const logger = options.logger || console;
  const rootDir = path.join(appPath, 'Mock Interviews');
  fs.mkdirSync(rootDir, { recursive: true });

  function listMockInterviews() {
    if (!fs.existsSync(rootDir)) {
      return [];
    }

    return fs.readdirSync(rootDir, { withFileTypes: true })
      .filter((item) => item.isDirectory())
      .flatMap((item) => {
        const dir = path.join(rootDir, item.name);
        return fs.readdirSync(dir)
          .filter((file) => file.endsWith('.json') && file !== 'meta.json')
          .map((file) => readJson(path.join(dir, file)))
          .filter(Boolean);
      })
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }

  function getMockInterview(id) {
    const cleanId = clean(id);
    if (!cleanId) {
      return null;
    }

    for (const item of listMockInterviews()) {
      if (item.id === cleanId) {
        return item;
      }
    }
    return null;
  }

  async function deleteMockInterview(id, settings = {}) {
    const existing = getMockInterview(id);
    if (!existing) {
      return false;
    }

    const entityId = sanitizeId(existing.opportunity?.id || existing.opportunity?.name || 'general');
    const filePath = path.join(rootDir, entityId, `${existing.id}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    const entityDir = path.join(rootDir, entityId);
    if (fs.existsSync(entityDir)) {
      const remaining = fs.readdirSync(entityDir).filter((file) => file.endsWith('.json') && file !== 'meta.json');
      if (remaining.length === 0) {
        fs.rmSync(entityDir, { recursive: true, force: true });
      }
    }

    if (knowledgeManager?.deleteKnowledgeItem) {
      try {
        await knowledgeManager.deleteKnowledgeItem(mockInterviewKnowledgeId(existing), settings);
      } catch (error) {
        logger.warn?.('Mock interview knowledge deletion failed:', error);
      }
    }

    return true;
  }

  async function saveMockInterview(record = {}, settings = {}) {
    const saved = normalizeMockRecord(record);
    const entityId = sanitizeId(saved.opportunity.id || saved.opportunity.name || 'general');
    const entityDir = path.join(rootDir, entityId);
    fs.mkdirSync(entityDir, { recursive: true });

    fs.writeFileSync(path.join(entityDir, 'meta.json'), JSON.stringify({
      id: entityId,
      name: saved.opportunity.name,
      role: saved.opportunity.role,
      updatedAt: new Date().toISOString()
    }, null, 2), 'utf8');

    fs.writeFileSync(path.join(entityDir, `${saved.id}.json`), JSON.stringify(saved, null, 2), 'utf8');

    if (settings.userTier === 'pro' && knowledgeManager?.upsertKnowledgeItem) {
      await archiveMockInterview(saved, settings);
    }

    return saved;
  }

  async function generateAssessment(payload = {}, settings = {}) {
    const transcript = normalizeTranscript(payload.transcript);
    if (!transcript.length) {
      throw new Error('Mock interview transcript is empty.');
    }

    const prompt = buildAssessmentPrompt({
      opportunity: payload.opportunity || {},
      transcript,
      durationSeconds: payload.durationSeconds
    });
    const schema = getAssessmentSchema();

    const provider = settings.llmProvider || 'local';
    const model = settings.mockInterviewAssessmentModel || settings.llmModel || (provider === 'openai' ? DEFAULT_OPENAI_MODEL : '');
    const messages = [
      {
        role: 'system',
        content: 'You are a direct interview coach. Score the user directly, addressing them as "you". Do NOT refer to them in the third person as "the candidate" or "the user". Be specific and practical.'
      },
      { role: 'user', content: prompt }
    ];

    const responseText = provider === 'openai'
      ? await generateOpenAIResponse({
          apiKey: settings.llmApiKey || settings.openAiApiKey || process.env.OPENAI_API_KEY || '',
          model,
          messages,
          schema,
          axiosClient
        })
      : await generateChat({
          provider,
          apiKey: settings.llmApiKey || '',
          model,
          localUrl: settings.localLlmUrl,
          axiosClient,
          temperature: 0.2,
          maxTokens: 6000,
          jsonSchema: {
            name: 'mock_interview_assessment',
            schema
          },
          messages
        });

    const assessment = parseAssessment(responseText);
    return {
      ...assessment,
      model: model || provider,
      generatedAt: new Date().toISOString()
    };
  }

  async function archiveMockInterview(record, settings = {}) {
    const content = buildKnowledgeContent(record);
    if (!content) {
      return null;
    }

    const now = new Date().toISOString();
    const knowledgeId = mockInterviewKnowledgeId(record);
    let item = knowledgeManager.upsertKnowledgeItem({
      id: knowledgeId,
      filename: `${record.date.slice(0, 10)} ${record.opportunity.name} mock interview.txt`,
      file_path: '',
      content,
      type: 'mock-interview',
      metadata: {
        source: 'mock-interview',
        mode: 'interview',
        entityId: record.opportunity.id,
        entityName: record.opportunity.name,
        role: record.opportunity.role,
        mockInterviewId: record.id,
        score: Number(record.assessment?.overallScore || 0),
        date: record.date
      },
      now
    });

    if (settings.userTier === 'pro') {
      try {
        item = await knowledgeManager.uploadToPinecone(item.id, settings);
      } catch (error) {
        logger.warn?.('Mock interview Pinecone indexing failed:', error);
      }
    }

    return item;
  }

  return {
    deleteMockInterview,
    generateAssessment,
    getMockInterview,
    listMockInterviews,
    saveMockInterview
  };
}

function mockInterviewKnowledgeId(record = {}) {
  return `mock-interview:${record.opportunity?.id || 'general'}:${record.id}`;
}

async function generateOpenAIResponse({ apiKey, model, messages, schema, axiosClient }) {
  if (!apiKey) {
    throw new Error('OpenAI API key is missing. Configure it in Settings to grade mock interviews.');
  }
  if (!axiosClient) {
    throw new Error('HTTP client is not available.');
  }

  const instructions = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n');
  const input = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content
    }));

  const response = await axiosClient.post('https://api.openai.com/v1/responses', {
    model: model || DEFAULT_OPENAI_MODEL,
    ...(instructions ? { instructions } : {}),
    input,
    text: {
      format: {
        type: 'json_schema',
        name: 'mock_interview_assessment',
        schema,
        strict: true
      }
    }
  }, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    timeout: 120000
  });

  return extractResponseText(response.data);
}

function extractResponseText(data = {}) {
  if (typeof data.output_text === 'string') {
    return data.output_text;
  }

  const output = Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (typeof part.text === 'string') {
        return part.text;
      }
    }
  }

  return '';
}

function normalizeMockRecord(record = {}) {
  const opportunity = record.opportunity || {};
  const name = clean(opportunity.name || record.company || 'General');
  const role = clean(opportunity.role || record.role);
  const date = clean(record.date) || new Date().toISOString();
  const id = clean(record.id) || `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  return {
    id,
    date,
    durationSeconds: Number(record.durationSeconds || 0),
    opportunity: {
      id: sanitizeId(opportunity.id || name || 'general'),
      name,
      role
    },
    title: clean(record.title) || `Mock interview - ${name}`,
    transcript: normalizeTranscript(record.transcript),
    assessment: normalizeAssessment(record.assessment),
    avatar: normalizeAvatarMetadata(record.avatar || record.avatarMetadata),
    savedToKnowledge: Boolean(record.savedToKnowledge)
  };
}

function normalizeTranscript(transcript = []) {
  return (Array.isArray(transcript) ? transcript : [])
    .map((turn) => ({
      id: clean(turn.id),
      role: turn.role === 'you' ? 'you' : turn.role === 'interviewer' ? 'interviewer' : clean(turn.role || 'interviewer'),
      text: clean(turn.text)
    }))
    .filter((turn) => turn.text);
}

function normalizeAssessment(assessment = {}) {
  const normalized = assessment && typeof assessment === 'object' ? assessment : {};
  return {
    overallScore: clampScore(normalized.overallScore),
    verdict: clean(normalized.verdict),
    executiveSummary: clean(normalized.executiveSummary),
    categories: normalizeCategories(normalized.categories),
    strengths: normalizeTextArray(normalized.strengths),
    risks: normalizeTextArray(normalized.risks),
    actionPlan: normalizeTextArray(normalized.actionPlan),
    answerReviews: normalizeAnswerReviews(normalized.answerReviews),
    nextPracticePrompt: clean(normalized.nextPracticePrompt),
    model: clean(normalized.model),
    generatedAt: clean(normalized.generatedAt)
  };
}

function parseAssessment(text) {
  const raw = clean(text);
  if (!raw) {
    throw new Error('Assessment response was empty.');
  }

  const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || raw);
  return normalizeAssessment(parsed);
}

function normalizeCategories(categories = []) {
  return (Array.isArray(categories) ? categories : [])
    .map((item) => ({
      name: clean(item.name),
      score: clampScore(item.score),
      rationale: clean(item.rationale),
      evidence: normalizeTextArray(item.evidence).slice(0, 3)
    }))
    .filter((item) => item.name);
}

function normalizeAnswerReviews(answerReviews = []) {
  return (Array.isArray(answerReviews) ? answerReviews : [])
    .map((item) => ({
      question: clean(item.question),
      score: clampScore(item.score),
      feedback: clean(item.feedback),
      betterAnswer: clean(item.betterAnswer)
    }))
    .filter((item) => item.question || item.feedback);
}

function normalizeTextArray(values = []) {
  return (Array.isArray(values) ? values : [])
    .map(clean)
    .filter(Boolean);
}

function normalizeAvatarMetadata(avatar = {}) {
  const normalized = avatar && typeof avatar === 'object' ? avatar : {};
  return {
    provider: clean(normalized.provider),
    avatarId: clean(normalized.avatarId),
    voiceId: clean(normalized.voiceId),
    sessionId: clean(normalized.sessionId)
  };
}

function buildAssessmentPrompt({ opportunity, transcript, durationSeconds }) {
  const company = clean(opportunity.name || 'the target company');
  const role = clean(opportunity.role || 'the target role');
  const transcriptText = transcript.map((turn) => `${turn.role === 'you' ? 'Candidate' : 'Interviewer'}: ${turn.text}`).join('\n');

  return `Assess this mock interview for ${company}, role: ${role}.
Duration seconds: ${Number(durationSeconds || 0)}

Transcript:
${transcriptText}

Return a detailed scorecard. Address the user directly as "you" (e.g., "you answered", "your score", "you demonstrated"). 
Do NOT refer to the user in the third person as "the candidate", "the user", or "he/she/his/her". Address the user as if you are talking directly to them.
Keep scores on a 0 to 100 scale. Include concrete rewrites for weak answers.`;
}

function getAssessmentSchema() {
  return {
    type: 'object',
    properties: {
      overallScore: { type: 'number' },
      verdict: { type: 'string' },
      executiveSummary: { type: 'string' },
      categories: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            score: { type: 'number' },
            rationale: { type: 'string' },
            evidence: { type: 'array', items: { type: 'string' } }
          },
          required: ['name', 'score', 'rationale', 'evidence'],
          additionalProperties: false
        }
      },
      strengths: { type: 'array', items: { type: 'string' } },
      risks: { type: 'array', items: { type: 'string' } },
      actionPlan: { type: 'array', items: { type: 'string' } },
      answerReviews: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            score: { type: 'number' },
            feedback: { type: 'string' },
            betterAnswer: { type: 'string' }
          },
          required: ['question', 'score', 'feedback', 'betterAnswer'],
          additionalProperties: false
        }
      },
      nextPracticePrompt: { type: 'string' }
    },
    required: ['overallScore', 'verdict', 'executiveSummary', 'categories', 'strengths', 'risks', 'actionPlan', 'answerReviews', 'nextPracticePrompt'],
    additionalProperties: false
  };
}

function buildKnowledgeContent(record = {}) {
  const assessment = normalizeAssessment(record.assessment);
  const transcript = normalizeTranscript(record.transcript)
    .map((turn) => `${turn.role === 'you' ? 'Candidate' : 'Interviewer'}: ${turn.text}`)
    .join('\n');

  return [
    `Mock interview for ${record.opportunity?.name || 'General'}${record.opportunity?.role ? `, ${record.opportunity.role}` : ''}`,
    record.avatar?.provider ? `Interviewer avatar: ${record.avatar.provider}${record.avatar.avatarId ? ` (${record.avatar.avatarId})` : ''}` : '',
    `Overall score: ${assessment.overallScore}`,
    assessment.verdict ? `Verdict: ${assessment.verdict}` : '',
    assessment.executiveSummary ? `Summary: ${assessment.executiveSummary}` : '',
    assessment.categories.length ? `Categories:\n${assessment.categories.map((item) => `- ${item.name}: ${item.score}. ${item.rationale}`).join('\n')}` : '',
    assessment.actionPlan.length ? `Action plan:\n${assessment.actionPlan.map((item) => `- ${item}`).join('\n')}` : '',
    transcript ? `Transcript:\n${transcript}` : ''
  ].filter(Boolean).join('\n\n').trim();
}

function clampScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(number)));
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_error) {
    return null;
  }
}

function clean(value) {
  return String(value || '').trim();
}

module.exports = {
  createMockInterviewManager,
  getAssessmentSchema,
  mockInterviewKnowledgeId,
  normalizeMockRecord
};
