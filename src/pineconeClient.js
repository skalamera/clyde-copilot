const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Pinecone } = require('@pinecone-database/pinecone');
const axios = require('axios');

async function retryWithBackoff(fn, retries = 3, delay = 1000) {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }
    const isRateLimit = error.status === 429 || 
                        (error.message && error.message.includes('429')) || 
                        (error.response && error.response.status === 429);
    
    if (isRateLimit) {
      console.warn(`[Embedding] Rate limit hit (429). Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

async function getCloudManagedFallback(text, options = {}) {
  try {
    const Store = require('electron-store').default || require('electron-store');
    const store = new Store();
    const accessToken = store.get('authAccessToken', '');
    
    if (accessToken) {
      const client = options.axiosClient || axios;
      const response = await client.post('https://clydeai.live/api/proxy?type=embed', {
        text
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });
      if (response.data && Array.isArray(response.data.embedding)) {
        return response.data.embedding;
      }
    }
  } catch (e) {
    console.error('Failed to retrieve cloud-managed embedding fallback:', e);
  }
  return null;
}

async function getEmbedding(text, options = {}) {
  const resolved = options.provider
    ? {
        provider: options.provider,
        model: options.model,
        apiKey: options.apiKey
      }
    : resolveEmbeddingConfig(options);
  const provider = resolved.provider || 'gemini';
  let apiKey = resolved.apiKey || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    const fallbackEmbedding = await getCloudManagedFallback(text, options);
    if (fallbackEmbedding) {
      return fallbackEmbedding;
    }

    console.warn(`${provider.toUpperCase()} embedding API key is not set, skipping embedding generation`);
    return [];
  }

  if (provider === 'openai') {
    const client = options.axiosClient || axios;
    try {
      const response = await retryWithBackoff(async () => {
        return await client.post('https://api.openai.com/v1/embeddings', {
          model: resolved.model || 'text-embedding-3-small',
          input: text
        }, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });
      }, 3, 1000);

      return response.data?.data?.[0]?.embedding || [];
    } catch (err) {
      console.error('[Embedding] OpenAI embedding failed, attempting Clyde Managed Cloud fallback...', err);
      const fallbackEmbedding = await getCloudManagedFallback(text, options);
      if (fallbackEmbedding) {
        return fallbackEmbedding;
      }
      throw err;
    }
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const embeddingModel = genAI.getGenerativeModel({ model: resolved.model || "gemini-embedding-2" });
    
    const result = await retryWithBackoff(async () => {
      return await embeddingModel.embedContent(text);
    }, 3, 1000);

    return result.embedding.values;
  } catch (err) {
    console.error('[Embedding] Gemini embedding failed, attempting Clyde Managed Cloud fallback...', err);
    const fallbackEmbedding = await getCloudManagedFallback(text, options);
    if (fallbackEmbedding) {
      return fallbackEmbedding;
    }
    throw err;
  }
}

function resolveEmbeddingConfig(settings = {}) {
  const provider = settings.embeddingProvider === 'openai' ? 'openai' : 'gemini';
  const defaultModel = provider === 'openai' ? 'text-embedding-3-small' : 'gemini-embedding-2';
  const apiKey = settings.embeddingApiKey
    || (provider === 'openai'
      ? (settings.llmApiKey || process.env.OPENAI_API_KEY || '')
      : (settings.geminiApiKey || process.env.GEMINI_API_KEY || ''));

  return {
    provider,
    model: settings.embeddingModel || defaultModel,
    apiKey
  };
}

function resolvePineconeConfig(settings = {}) {
  return {
    apiKey: settings.pineconeApiKey || process.env.PINECONE_API_KEY || '',
    host: normalizeHost(settings.pineconeHost || process.env.PINECONE_HOST || ''),
    namespace: settings.pineconeNamespace || 'clyde-pro-knowledge'
  };
}

async function searchResumeVectors(queryText, topK = 3) {
  const pineconeApiKey = process.env.PINECONE_API_KEY;
  const pineconeHost = process.env.PINECONE_HOST;

  if (!pineconeApiKey || !pineconeHost) {
    console.warn("PINECONE_API_KEY or PINECONE_HOST is missing, skipping RAG retrieval");
    return [];
  }

  const pc = new Pinecone({ apiKey: pineconeApiKey });
  // Pass the host directly for custom endpoint routing if you need it,
  // or use the index name from the host if preferred. 
  // We'll use the native fetch directly against the host to ensure it hits your specific cluster.

  const vector = await getEmbedding(queryText);

  const response = await axios.post(`${pineconeHost}/query`, {
    vector,
    topK,
    includeMetadata: true
  }, {
    headers: {
      'Api-Key': pineconeApiKey,
      'Content-Type': 'application/json'
    }
  });

  if (!response.data || !response.data.matches) {
    console.log(`[RAG] Pinecone search returned no matches for question: "${queryText}"`);
    return [];
  }

  const matches = response.data.matches.map(match => ({
    score: match.score,
    text: match.metadata?.text || '',
    source: match.metadata?.source || 'unknown'
  }));

  console.log(`[RAG] Successfully retrieved ${matches.length} context chunks from Pinecone for question: "${queryText}"`);
  
  return matches;
}

async function upsertKnowledgeChunks({
  knowledgeItem,
  chunks = [],
  settings = {},
  axiosClient = axios,
  getEmbeddingFn
} = {}) {
  const config = resolvePineconeConfig(settings);
  if (!config.apiKey || !config.host) {
    return { ok: false, skipped: 'missing-pinecone-config' };
  }

  const cleanChunks = chunks.map((chunk) => String(chunk || '').trim()).filter(Boolean);
  if (!knowledgeItem?.id || !cleanChunks.length) {
    return { ok: false, skipped: 'missing-knowledge-content' };
  }

  const embeddingConfig = resolveEmbeddingConfig(settings);
  const vectors = [];
  const sharedMetadata = sanitizePineconeMetadata(knowledgeItem.metadata || {});

  for (let index = 0; index < cleanChunks.length; index += 1) {
    const text = cleanChunks[index];
    const vector = getEmbeddingFn
      ? await getEmbeddingFn(text, embeddingConfig)
      : await getEmbedding(text, { ...embeddingConfig, axiosClient });

    if (!Array.isArray(vector) || vector.length === 0) {
      continue;
    }

    vectors.push({
      id: `${knowledgeItem.id}:chunk:${index}`,
      values: vector,
      metadata: {
        ...sharedMetadata,
        knowledgeId: knowledgeItem.id,
        filename: knowledgeItem.filename || '',
        source: knowledgeItem.filename || knowledgeItem.file_path || 'knowledge',
        type: knowledgeItem.type || 'upload',
        text
      }
    });
  }

  if (!vectors.length) {
    return { ok: false, skipped: 'missing-embeddings' };
  }

  const response = await axiosClient.post(`${config.host}/vectors/upsert`, {
    vectors,
    namespace: config.namespace
  }, {
    headers: {
      'Api-Key': config.apiKey,
      'Content-Type': 'application/json'
    }
  });

  return {
    ok: true,
    count: Number(response.data?.upsertedCount || vectors.length) || vectors.length,
    namespace: config.namespace
  };
}

async function searchKnowledgeVectors(queryText, settings = {}, options = {}) {
  const config = resolvePineconeConfig(settings);
  if (!config.apiKey || !config.host) {
    return [];
  }

  const embeddingConfig = resolveEmbeddingConfig(settings);
  const vector = options.getEmbeddingFn
    ? await options.getEmbeddingFn(queryText, embeddingConfig)
    : await getEmbedding(queryText, { ...embeddingConfig, axiosClient: options.axiosClient || axios });

  if (!Array.isArray(vector) || vector.length === 0) {
    return [];
  }

  const client = options.axiosClient || axios;
  try {
    const response = await client.post(`${config.host}/query`, {
      vector,
      topK: options.topK || 5,
      includeMetadata: true,
      namespace: config.namespace,
      ...(options.filter ? { filter: options.filter } : {})
    }, {
      headers: {
        'Api-Key': config.apiKey,
        'Content-Type': 'application/json'
      }
    });

    return (response.data?.matches || []).map((match) => ({
      score: match.score,
      text: match.metadata?.text || '',
      source: match.metadata?.source || match.metadata?.filename || 'knowledge',
      knowledgeId: match.metadata?.knowledgeId || '',
      type: match.metadata?.type || '',
      metadata: match.metadata || {}
    }));
  } catch (error) {
    console.error('[Pinecone] Search query failed:', error.response?.data || error.message);
    return [];
  }
}

function normalizeHost(host) {
  return String(host || '').replace(/\/+$/, '');
}

function sanitizePineconeMetadata(metadata = {}) {
  const result = {};
  const entries = metadata && typeof metadata === 'object' ? Object.entries(metadata) : [];

  for (const [key, value] of entries) {
    if (!key) {
      continue;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      const values = value
        .map((item) => (item == null ? '' : String(item).trim()))
        .filter(Boolean);
      if (values.length) {
        result[key] = values;
      }
    }
  }

  return result;
}

async function detectResumeQuestion(transcript) {
  const localQuestion = extractLikelyInterviewQuestion(transcript);
  if (localQuestion) {
    return localQuestion;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY missing, skipping intent detection");
    return null;
  }
  
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `Analyze the following meeting transcript. 
Determine if any speaker (other than "You") is currently asking "You" a fully complete question about your professional history, past projects, work experience, or a general job interview question (e.g. behavioral questions, "how would you handle X", "what is your 30-60-90 day plan", strengths/weaknesses).

CRITICAL RULES:
1. The question MUST be grammatically complete. If the speaker trails off or is mid-sentence (e.g. "Can you tell me how the...", "What did you do at...", "How the CV site project was architected", "If you were to get the job, what would"), set isAskingInterviewQuestion to false.
2. Only consider the very last statements in the transcript. Do not extract questions that were asked and already answered earlier in the transcript.
3. If the transcript is just a fragment or the person hasn't finished their thought, set isAskingInterviewQuestion to false.
4. If yes and the question is fully finished, extract the core question.

Transcript:
${transcript}

Return ONLY a JSON object with this structure:
{
  "isAskingInterviewQuestion": boolean,
  "question": string | null
}`;

    let result;
    let retries = 3;
    while (retries > 0) {
      try {
        result = await model.generateContent(prompt);
        break;
      } catch (e) {
        retries--;
        if (retries === 0) throw e;
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    const text = result.response.text();
    
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.isAskingInterviewQuestion && parsed.question && parsed.question.length > 25) {
        return parsed.question;
      }
    }
  } catch (error) {
    console.error("Intent detection error:", error);
  }
  return null;
}

function extractLikelyInterviewQuestion(transcript) {
  const candidates = getLatestInterviewQuestionCandidates(transcript);

  for (const candidate of candidates) {
    if ((isCompleteQuestion(candidate) || isLikelyCompleteAsrQuestion(candidate)) && isLikelyInterviewQuestionText(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getLatestInterviewQuestionCandidates(transcript) {
  const turns = parseTranscriptTurns(transcript);
  const latestUserIndex = findLastIndex(turns, (turn) => isUserSpeakerLabel(turn.speaker));
  const recentNonUserTurns = turns
    .slice(latestUserIndex + 1)
    .filter((turn) => turn.text && !isUserSpeakerLabel(turn.speaker))
    .slice(-8);
  const candidates = [];

  for (let endIndex = recentNonUserTurns.length - 1; endIndex >= 0; endIndex -= 1) {
    const maxWindow = Math.min(5, endIndex + 1);

    for (let size = maxWindow; size >= 1; size -= 1) {
      const fragments = recentNonUserTurns
        .slice(endIndex - size + 1, endIndex + 1)
        .map((turn) => turn.text);
      const combined = combineTranscriptFragments(fragments);
      const segments = splitQuestionishSegments(combined).reverse();

      candidates.push(...segments);
    }
  }

  return dedupeStrings(candidates);
}

function parseTranscriptTurns(transcript) {
  return String(transcript || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseTranscriptLine);
}

function parseTranscriptLine(line) {
  const match = String(line || '').match(/^([^:]{1,80}):\s*(.+)$/);

  if (!match) {
    return { speaker: '', text: cleanQuestionText(line) };
  }

  return {
    speaker: match[1].trim(),
    text: cleanQuestionText(match[2])
  };
}

function cleanQuestionText(text) {
  return String(text || '').trim().replace(/\s+/g, ' ');
}

function combineTranscriptFragments(fragments) {
  let combined = '';

  for (const fragment of fragments) {
    const text = cleanQuestionText(fragment);

    if (!text) {
      continue;
    }

    if (!combined) {
      combined = text;
      continue;
    }

    const lowerCombined = combined.toLowerCase();
    const lowerText = text.toLowerCase();

    if (lowerText.startsWith(`${lowerCombined} `) || lowerText === lowerCombined) {
      combined = text;
      continue;
    }

    combined = mergeFragmentBoundary(combined, text);
  }

  return cleanQuestionText(combined);
}

function mergeFragmentBoundary(left, right) {
  const leftWords = cleanQuestionText(left).split(' ');
  const rightWords = cleanQuestionText(right).split(' ');
  const maxOverlap = Math.min(6, leftWords.length, rightWords.length);

  for (let size = maxOverlap; size > 0; size -= 1) {
    const leftTail = leftWords.slice(-size).join(' ').toLowerCase();
    const rightHead = rightWords.slice(0, size).join(' ').toLowerCase();

    if (leftTail === rightHead) {
      return [...leftWords, ...rightWords.slice(size)].join(' ');
    }
  }

  return `${left} ${right}`;
}

function splitQuestionishSegments(text) {
  return cleanQuestionText(text)
    .split(/(?<=\?)\s+|(?<=\.)\s+(?=(?:can|could|would|what|why|how|if)\b)/i)
    .map(cleanQuestionText)
    .filter(Boolean);
}

function dedupeStrings(values) {
  const seen = new Set();
  const deduped = [];

  for (const value of values) {
    const normalized = value.toLowerCase();

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    deduped.push(value);
  }

  return deduped;
}

function findLastIndex(values, predicate) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (predicate(values[index], index)) {
      return index;
    }
  }

  return -1;
}

function isUserSpeakerLabel(speaker) {
  return /^(you|user|candidate|me|mic|microphone)$/i.test(String(speaker || '').trim());
}

function isCompleteQuestion(text) {
  const clean = cleanQuestionText(text);

  if (clean.length < 20) {
    return false;
  }

  if (/\?\s*$/.test(clean)) {
    return true;
  }

  if (hasCompleteInterviewPromptCue(clean) && /[.!]\s*$/.test(clean)) {
    return true;
  }

  return /^(can|could|would|what|why|how|tell|walk|if)\b/i.test(clean)
    && /[.!]\s*$/.test(clean);
}

function isLikelyCompleteAsrQuestion(text) {
  const normalized = cleanQuestionText(text).toLowerCase();

  if (/[?.!]\s*$/.test(normalized) || normalized.length < 45) {
    return false;
  }

  return [
    /\bhave you had\b.*\b(gen ai|generative ai|automation)\b.*\b(customer support|support workflows|workflows)\b/,
    /\bwalk me through\b.*\bprocess\b.*\b(downstream|systems|teams|effects|impact)\b/,
    /\btalk me through\b.*\bprocess\b.*\b(downstream|systems|teams|effects|impact)\b/
  ].some((pattern) => pattern.test(normalized));
}

function hasCompleteInterviewPromptCue(text) {
  const normalized = cleanQuestionText(text).toLowerCase();

  return [
    /\bwalk me through\b/,
    /\btalk me through\b/,
    /\btell me about a time\b/,
    /\bcan you tell me about a time\b/,
    /\bcan you describe a time\b/,
    /\bdescribe a time\b/,
    /\bshare an example\b/,
    /\bgive me an example\b/,
    /\bhave you had (an )?experience\b/,
    /\bhow do you evaluate\b/,
    /\bwhat'?s your process\b/,
    /\bwhat is your process\b/,
    /\bhow did you navigate\b/
  ].some((pattern) => pattern.test(normalized));
}

function isLikelyInterviewQuestionText(text) {
  const normalized = cleanQuestionText(text).toLowerCase();

  if (/\b(i have|i've got|i will|i'll)\b.*\bquestions\b/.test(normalized)
    || /\blooking for\b.*\b(specific )?examples\b/.test(normalized)) {
    return false;
  }

  return [
    /\bwhy do you think you would be (a )?good fit\b/,
    /\bwhy (are|would) you (a )?good fit\b/,
    /\bwhat makes you (a )?good fit\b/,
    /\bwhy should we hire you\b/,
    /\bwhy (this|the) (role|position|company)\b/,
    /\bwhy are you interested in (this|the) (role|position|company)\b/,
    /\bwhy do you want (this|the) (role|position)\b/,
    /\btell me about yourself\b/,
    /\bwhere are you currently working\b/,
    /\bwhat'?s the name of (our|the) company\b/,
    /\bwalk me through your (background|experience|resume|career)\b/,
    /\bcan you walk me through your (background|experience|resume|career)\b/,
    /\bwalk me through\b.*\b(process|experience|time|project|crm|ticketing|workflow|system|systems|integration|efficiency)\b/,
    /\btalk me through\b.*\b(process|experience|time|project|integration|system|systems|workflow)\b/,
    /\btell me about (a|one of your|your) (project|time|experience)\b/,
    /\btell me about a time\b.*\b(align|aligned|stakeholder|stakeholders|conflict|conflicted|navigate|navigated|technical project)\b/,
    /\bcan you describe a time\b.*\b(designed|maintained|built|implemented|integrated|integration|api|system|workflow|stakeholder|stakeholders)\b/,
    /\bcan you tell me about\b.*\b(project|experience|role|background|career)\b/,
    /\bcan you tell me about a time\b.*\b(stakeholder|stakeholders|product|engineering|operations|priorities|conflicted|navigate|navigated)\b/,
    /\bcan you tell me how\b.*\b(architected|built|secured|securing|designed|implemented)\b/,
    /\bhave you had (an )?experience\b.*\b(gen ai|generative ai|automation|tools|workflow|workflows|support|customer support)\b/,
    /\bhow do you evaluate\b.*\b(downstream|systems|teams|impact|effects|process)\b/,
    /\bwhat'?s your process\b.*\b(downstream|systems|teams|impact|effects)\b/,
    /\b(api|crm|ticketing|customer experience|support)\b.*\b(integration|integrated|automation|workflow|workflows|optimized|efficiency)\b/,
    /\b(product|engineering|operations|stakeholder|stakeholders)\b.*\b(align|alignment|conflict|conflicted|priorities|navigate|navigated)\b/,
    /\bcan you (give|share) (me )?an example\b/,
    /\bhow would you handle\b/,
    /\bwhat (are|is) your (strengths|weaknesses)\b/,
    /\bwhat is your 30[-\s]?60[-\s]?90 day plan\b/,
    /\bif you were to get the job\b.*\bplan\b/,
    /\bwhat would your (30|thirty)\b.*\b(60|sixty)\b.*\b(90|ninety)\b.*\bplan\b/
  ].some((pattern) => pattern.test(normalized));
}

  async function deleteKnowledgeVectors(knowledgeId, settings = {}, options = {}) {
    const config = resolvePineconeConfig(settings);
    if (!config.apiKey || !config.host) {
      return { ok: false, skipped: 'missing-pinecone-config' };
    }
    
    if (!knowledgeId) {
      return { ok: false, skipped: 'missing-knowledge-id' };
    }

    const client = options.axiosClient || axios;
    try {
      const response = await client.post(`${config.host}/vectors/delete`, {
        filter: { knowledgeId: { "$eq": knowledgeId } },
        namespace: config.namespace
      }, {
        headers: {
          'Api-Key': config.apiKey,
          'Content-Type': 'application/json'
        }
      });
      return { ok: response.status >= 200 && response.status < 300 };
    } catch (error) {
      return { ok: false, message: error.response?.data?.message || error.message };
    }
  }

module.exports = {
  deleteKnowledgeVectors,
  detectResumeQuestion,
  extractLikelyInterviewQuestion,
  getEmbedding,
  resolveEmbeddingConfig,
  resolvePineconeConfig,
  sanitizePineconeMetadata,
  searchKnowledgeVectors,
  searchResumeVectors,
  upsertKnowledgeChunks
};
