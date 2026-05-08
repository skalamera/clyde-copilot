const { detectResumeQuestion, searchResumeVectors } = require('./pineconeClient');

const DEFAULT_INTERVAL_MS = 30000;
const DEFAULT_MAX_TURNS = 10;
const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_MAX_TOKENS = 800;

function createMeetingAssistant(options = {}) {
  const apiUrl = (options.apiUrl || '').trim();
  const model = (options.model || '').trim();
  const axiosClient = options.axiosClient;
  const logger = options.logger || console;
  const sendUpdate = options.sendUpdate || (() => {});
  const sendStatus = options.sendStatus || (() => {});
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;

  let transcriptTurns = [];
  let lastRunAt = 0;
  let inFlight = false;
  let lastDigest = '';
  let currentContext = {};

  function setContext(context) {
    if (context) {
      currentContext = context;
    }
  }

  async function addTranscript(turn) {
    if (!turn || !turn.text) {
      return { ok: true, skipped: 'empty' };
    }

    const speaker = turn.speaker || 'Unknown';
    const text = String(turn.text).trim();

    // Smart merge: if the last turn was the same speaker, merge the text instead of creating a new line
    if (transcriptTurns.length > 0 && transcriptTurns[transcriptTurns.length - 1].speaker === speaker) {
      transcriptTurns[transcriptTurns.length - 1].text += ' ' + text;
    } else {
      transcriptTurns.push({
        speaker: speaker,
        text: text
      });
    }

    // Still respect max turns, but note that turns are now full blocks of speech
    transcriptTurns = transcriptTurns.slice(-maxTurns);

    if (isUserSpeaker(turn.speaker)) {
      return { ok: true, skipped: 'user-speaker' };
    }

    return maybeRun();
  }

  async function maybeRun(force = false, isSuggestionRequest = false) {
    if (!apiUrl || !model) {
      return { ok: true, skipped: 'not-configured' };
    }

    if (inFlight) {
      return { ok: true, skipped: 'in-flight' };
    }

    const now = Date.now();

    if (!force && now - lastRunAt < intervalMs) {
      return { ok: true, skipped: 'rate-limited' };
    }

    const digest = transcriptTurns
      .map((turn) => `${turn.speaker}: ${turn.text}`)
      .join('\n');

    // Only check for unchanged if it's NOT a forced suggestion request
    if (!isSuggestionRequest && (!digest || digest === lastDigest)) {
      return { ok: true, skipped: 'unchanged' };
    }

    inFlight = true;

    try {
      let ragContext = '';
      let targetQuestion = '';
      try {
        const extractedQuestion = await detectResumeQuestion(digest);
        if (extractedQuestion) {
           logger.log(`[RAG] Detected interview-related question in transcript: "${extractedQuestion}"`);
           targetQuestion = extractedQuestion;
           // Ensure Pinecone keys are loaded from process.env if they exist
           if (process.env.PINECONE_API_KEY && !process.env.PINECONE_HOST) {
               // Load fallback from env if not explicitly passed
           }
           const vectors = await searchResumeVectors(extractedQuestion);
           if (vectors && vectors.length > 0) {
             logger.log(`[RAG] Injecting Pinecone context into LM Studio prompt.`);
             ragContext = "Relevant facts from the user's resume and past projects:\n" + 
               vectors.map(v => `- ${v.text}`).join('\n');
           }
        } else {
           logger.log(`[RAG] No interview-related question detected in current transcript window.`);
           inFlight = false;
           // Wait another tick, do not update lastRunAt or lastDigest to allow 
           // the transcript to accumulate more context for the next run
           return { ok: true, skipped: 'no-question' };
        }
      } catch (err) {
        logger.error('[RAG] Intent/retrieval error:', err);
      }

      // If we got this far, a question was found, so we update the timers to lock out subsequent calls
      lastRunAt = now;
      lastDigest = digest;

      // Default: only ask for answers
      let jsonSchemaProperties = {
        answers: { 
          type: 'array', 
          items: { 
            type: 'object', 
            properties: { 
              question: { type: 'string' }, 
              bullets: { type: 'array', items: { type: 'string' } } 
            }, 
            required: ['question', 'bullets'] 
          } 
        }
      };

      let systemPromptInstructions = [
        `CRITICAL DIRECTIVE: The interviewer just asked THIS specific question: "${targetQuestion}"`,
        'You MUST answer this exact question and ignore all other questions in the transcript.',
        'DO NOT give the candidate advice or instructions on how to structure their answer.',
        'Write the actual answers for the candidate to read out loud. Use first-person language ("I led...", "I built...", "At my previous role...", "I would handle this by...").',
        'If the question asks about past experience, projects, or background, you MUST extract the specific projects, company names, metrics, and details EXCLUSIVELY from the provided RAG context.',
        'If the question is a general behavioral or situational question (e.g. strengths, weaknesses, 30-60-90 day plan) that is not in the RAG context, use standard interview best practices to formulate a strong, professional response.',
        'Never suggest questions for the interviewer to ask. Only suggest what the candidate ("You") should say.',
        'Schema: {"answers":[{"question":"...","bullets":["..."]}]}.'
      ];

      // If user clicked the "What to say next" button, switch schema to suggestions only
      if (isSuggestionRequest) {
        jsonSchemaProperties = {
          suggestions: { 
            type: 'array', 
            items: { 
              type: 'object', 
              properties: { text: { type: 'string' } }, 
              required: ['text'] 
            } 
          }
        };
        systemPromptInstructions = [
          'The candidate has explicitly asked for a suggestion on what to say or ask next.',
          'DO NOT give the candidate advice.',
          'Provide a concise, first-person script ("I would like to add...", "Can you tell me more about...") for what the candidate ("You") should say to drive the conversation forward.',
          'If mentioning past work, extract the experience details EXCLUSIVELY from the provided RAG context.',
          'Schema: {"suggestions":[{"text":"..."}]}.'
        ];
      }

      const response = await axiosClient.post(apiUrl, {
        model,
        temperature: 0.2,
        max_tokens: maxTokens,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'assistant_cards',
            schema: {
              type: 'object',
              properties: jsonSchemaProperties,
              additionalProperties: false
            }
          }
        },
        reasoning: {
          effort: 'none'
        },
        messages: [
          {
            role: 'system',
            content: [
              'You are Clyde, a live job interview copilot.',
              'The user wearing Clyde ("You") is the job candidate.',
              'The "System Audio" and any other speakers are the interviewers.',
              'Base your answers, hints/tips, and suggested next lines on what the interviewer is asking and the flow of the conversation.',
              ...systemPromptInstructions,
              currentContext.jobDescription ? `\nJob Description:\n${currentContext.jobDescription}\n` : '',
              ragContext ? `\nRelevant RAG Context:\n${ragContext}\n` : '',
              'Include only items that are useful right now. Do not include markdown fences.',
              'Use at most 3 total cards. Keep every value concise. Empty arrays are allowed. Do not mention that you are an AI.'
            ].filter(Boolean).join(' ')
          },
          {
            role: 'user',
            content: `Transcript:\n${digest}\n\nCreate cards that help me respond to the other people.`
          }
        ]
      }, { timeout });

      const text = extractAssistantText(response && response.data);
      const cards = parseAssistantCards(text);

      if (cards.length) {
        sendUpdate({
          title: 'Live help',
          text,
          cards
        });
        
        // CLEAR the transcript buffer of the current digest so we don't accidentally re-answer these old questions!
        // Because of smart merging, we can't just check text strings. We just empty the array.
        transcriptTurns = [];
        lastDigest = '';
        
        sendStatus({ state: 'capturing', message: 'Meeting assistant updated.' });
      } else if (text) {
        logger.log('Ignored non-JSON assistant response or empty array:', text);
        // Fast retry: The model failed to answer the question, so we reset the timers to let it try again on the next audio chunk
        lastRunAt = 0;
        lastDigest = '';
        sendStatus({ state: 'warning', message: 'Model returned empty answers. Will auto-retry...' });
      } else {
        sendStatus({
          state: 'warning',
          message: 'LM Studio returned an empty assistant message. Increase LM_STUDIO_ASSISTANT_MAX_TOKENS or disable model reasoning.'
        });
      }

      return { ok: true, text, cards };
    } catch (error) {
      const message = describeAssistantError(error);
      logger.error('Meeting assistant failed:', message);
      sendStatus({ state: 'warning', message });

      return { ok: false, message, error };
    } finally {
      inFlight = false;
    }
  }

  function requestSuggestion() {
    return maybeRun(true, true);
  }

  return {
    addTranscript,
    maybeRun,
    requestSuggestion,
    setContext,
    getTranscriptTurns: () => [...transcriptTurns]
  };
}

function extractAssistantText(data) {
  if (!data) {
    return '';
  }

  const choice = data.choices && data.choices[0];

  let content = '';

  if (choice && choice.message && choice.message.content) {
    content = String(choice.message.content).trim();
  } else if (choice && choice.text) {
    content = String(choice.text).trim();
  } else if (data.output_text) {
    content = String(data.output_text).trim();
  }

  // Remove any `<think>...</think>` blocks from the output
  if (content) {
    content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  }

  return content;
}

function isUserSpeaker(speaker) {
  return String(speaker || '').trim().toLowerCase() === 'you';
}

function parseAssistantCards(text) {
  const parsed = parseJsonObject(text);

  if (!parsed) {
    return [];
  }

  const cards = [];

  for (const item of toArray(parsed.answers)) {
    const question = cleanText(item.question);
    const bullets = Array.isArray(item.bullets) ? item.bullets.map(cleanText).filter(Boolean) : [];

    if (question || bullets.length > 0) {
      // Create a stable ID hash for this answer to prevent re-showing dismissed cards
      const id = Buffer.from(question).toString('base64');
      cards.push({
        type: 'answer',
        title: 'Answer',
        question,
        bullets,
        id
      });
    }
  }

  for (const item of toArray(parsed.questions)) {
    const textValue = cleanText(item.text || item.question);
    const why = cleanText(item.why);

    if (textValue) {
      cards.push({
        type: 'question',
        title: 'Question to ask',
        body: textValue,
        detail: why
      });
    }
  }

  for (const item of toArray(parsed.suggestions)) {
    const textValue = cleanText(item.text || item.suggestion);
    const why = cleanText(item.why);

    if (textValue) {
      cards.push({
        type: 'suggestion',
        title: 'Say next',
        body: textValue,
        detail: why
      });
    }
  }

  for (const item of toArray(parsed.actions)) {
    const textValue = cleanText(item.text || item.action);

    if (textValue) {
      cards.push({
        type: 'action',
        title: 'Action',
        body: textValue
      });
    }
  }

  for (const item of toArray(parsed.risks)) {
    const textValue = cleanText(item.text || item.risk);

    if (textValue) {
      cards.push({
        type: 'risk',
        title: 'Watch',
        body: textValue
      });
    }
  }

  return cards.slice(0, 4);
}

function parseJsonObject(text) {
  const value = String(text || '').trim();

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    const start = value.indexOf('{');
    const end = value.lastIndexOf('}');

    if (start === -1 || end <= start) {
      return null;
    }

    try {
      return JSON.parse(value.slice(start, end + 1));
    } catch (__error) {
      return null;
    }
  }
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value) {
  return String(value || '').trim();
}

function describeAssistantError(error) {
  const url = error && error.config && error.config.url
    ? ` calling ${error.config.url}`
    : '';

  if (error && error.response) {
    return `HTTP ${error.response.status} from ${error.config && error.config.url ? error.config.url : 'LM Studio assistant'}`;
  }

  if (error && error.code) {
    return `${error.code}${url}`;
  }

  if (error && error.message) {
    return `${error.message}${url}`;
  }

  return `Unknown LM Studio assistant error${url}`;
}

module.exports = {
  createMeetingAssistant,
  describeAssistantError,
  extractAssistantText,
  isUserSpeaker,
  parseAssistantCards
};
