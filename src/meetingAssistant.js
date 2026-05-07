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

    transcriptTurns.push({
      speaker: turn.speaker || 'Unknown',
      text: String(turn.text).trim()
    });
    transcriptTurns = transcriptTurns.slice(-maxTurns);

    if (isUserSpeaker(turn.speaker)) {
      return { ok: true, skipped: 'user-speaker' };
    }

    return maybeRun();
  }

  async function maybeRun(force = false) {
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

    if (!digest || digest === lastDigest) {
      return { ok: true, skipped: 'unchanged' };
    }

    lastRunAt = now;
    lastDigest = digest;
    inFlight = true;

    try {
      let ragContext = '';
      try {
        const extractedQuestion = await detectResumeQuestion(digest);
        if (extractedQuestion) {
           logger.log('Detected resume question:', extractedQuestion);
           const vectors = await searchResumeVectors(extractedQuestion);
           if (vectors && vectors.length > 0) {
             ragContext = "Relevant facts from the user's resume and past projects:\n" + 
               vectors.map(v => `- ${v.text}`).join('\n');
           }
        }
      } catch (err) {
        logger.error('RAG intent/retrieval error:', err);
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
              properties: {
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
                },
                questions: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
                suggestions: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
                actions: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
                risks: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } }
              },
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
              'ONLY answer explicit questions that the interviewer has just asked in the most recent transcript lines.',
              'NEVER generate answers to questions that have not been asked yet, or questions from past interviews.',
              'Provide detailed, highlight-focused answers using bullet points that the candidate can say.',
              'Never suggest questions for the interviewer to ask. Only suggest what the candidate ("You") should say or ask.',
              currentContext.jobDescription ? `\nJob Description:\n${currentContext.jobDescription}\n` : '',
              currentContext.resume ? `\nCandidate Resume/Background:\n${currentContext.resume}\n` : '',
              ragContext ? `\nRelevant RAG Context:\n${ragContext}\n` : '',
              'Include only items that are useful right now. Do not include markdown fences.',
              'Schema: {"answers":[{"question":"...","bullets":["..."]}],"questions":[{"text":"..."}],"suggestions":[{"text":"..."}],"actions":[{"text":"..."}],"risks":[{"text":"..."}]}.',
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
        sendStatus({ state: 'capturing', message: 'Meeting assistant updated.' });
      } else if (text) {
        logger.log('Ignored non-JSON assistant response:', text);
        sendStatus({ state: 'warning', message: 'LM Studio returned text but no valid JSON suggestions.' });
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

  return {
    addTranscript,
    maybeRun,
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
