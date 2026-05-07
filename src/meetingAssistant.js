const DEFAULT_INTERVAL_MS = 8000;
const DEFAULT_MAX_TURNS = 24;
const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_MAX_TOKENS = 900;

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

  async function addTranscript(turn) {
    if (!turn || !turn.text) {
      return { ok: true, skipped: 'empty' };
    }

    transcriptTurns.push({
      speaker: turn.speaker || 'Unknown',
      text: String(turn.text).trim()
    });
    transcriptTurns = transcriptTurns.slice(-maxTurns);

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
      const response = await axiosClient.post(apiUrl, {
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        max_tokens: maxTokens,
        reasoning: {
          effort: 'none'
        },
        messages: [
          {
            role: 'system',
            content: [
              'You are Casper, a live meeting copilot.',
              'Speaker labels matter: "You" is the user wearing Casper. Do not treat "You" as another meeting attendee.',
              'Use "System Audio" and any non-You speakers as the other people in the meeting.',
              'Base answers, suggested things to say, and follow-up questions on what other people said.',
              'Only answer questions asked by other people, unless the user directly asked Casper for help.',
              'If another person asked a question, write the exact question and a concise answer the user can say.',
              'If context is missing, write the exact clarification the user can ask.',
              'Include only items that are useful right now.',
              'Return valid JSON only. Do not include markdown fences.',
              'Use this schema: {"answers":[{"question":"...","answer":"..."}],"questions":[{"text":"...","why":"..."}],"suggestions":[{"text":"...","why":"..."}],"actions":[{"text":"..."}],"risks":[{"text":"..."}]}.',
              'Keep each field short. Empty arrays are allowed. Do not mention that you are an AI.'
            ].join(' ')
          },
          {
            role: 'user',
            content: `Latest transcript:\n${digest}\n\nCreate cards that help me respond to the other people in the meeting.`
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
        sendUpdate({
          title: 'Live help',
          text,
          cards: createFallbackCards(text)
        });
        sendStatus({ state: 'capturing', message: 'Meeting assistant updated.' });
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
    getTranscriptTurns: () => [...transcriptTurns]
  };
}

function extractAssistantText(data) {
  if (!data) {
    return '';
  }

  const choice = data.choices && data.choices[0];

  if (choice && choice.message && choice.message.content) {
    return String(choice.message.content).trim();
  }

  if (choice && choice.text) {
    return String(choice.text).trim();
  }

  if (data.output_text) {
    return String(data.output_text).trim();
  }

  return '';
}

function parseAssistantCards(text) {
  const parsed = parseJsonObject(text);

  if (!parsed) {
    return [];
  }

  const cards = [];

  for (const item of toArray(parsed.answers)) {
    const question = cleanText(item.question);
    const answer = cleanText(item.answer);

    if (question || answer) {
      cards.push({
        type: 'answer',
        title: 'Answer',
        question,
        body: answer
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

  return cards.slice(0, 12);
}

function createFallbackCards(text) {
  return cleanText(text)
    .split(/\n+/)
    .map((line) => cleanText(line.replace(/^[-*]\s*/, '')))
    .filter(Boolean)
    .slice(0, 8)
    .map((body) => ({
      type: 'note',
      title: 'Live help',
      body
    }));
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
  createFallbackCards,
  describeAssistantError,
  extractAssistantText,
  parseAssistantCards
};
