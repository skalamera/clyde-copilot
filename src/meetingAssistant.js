const { detectResumeQuestion, searchResumeVectors } = require('./pineconeClient');
const { generateChat } = require('./llmClient');
const { buildAssistantPrompt, getAssistantSchema, normalizeMode } = require('./assistantPrompts');

const DEFAULT_INTERVAL_MS = 30000;
const DEFAULT_MAX_TURNS = 10;
const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_MAX_TOKENS = 800;

function createMeetingAssistant(options = {}) {
  const settings = options.settings || {};
  const provider = settings.llmProvider || 'local';
  const apiKey = settings.llmApiKey || '';
  const model = settings.llmModel || '';
  const localUrl = settings.localLlmUrl;

  const axiosClient = options.axiosClient;
  const logger = options.logger || console;
  const sendUpdate = options.sendUpdate || (() => {});
  const sendStatus = options.sendStatus || (() => {});
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;

  let transcriptTurns = [];
  let recentHistory = [];
  let lastRunAt = 0;
  let inFlight = false;
  let lastDigest = '';
  let currentContext = {};
  let newlyAccumulatedTurns = 0;

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
      newlyAccumulatedTurns++;
    }

    if (recentHistory.length > 0 && recentHistory[recentHistory.length - 1].speaker === speaker) {
      recentHistory[recentHistory.length - 1].text += ' ' + text;
    } else {
      recentHistory.push({
        speaker: speaker,
        text: text
      });
    }

    // Still respect max turns, but note that turns are now full blocks of speech
    transcriptTurns = transcriptTurns.slice(-maxTurns);
    recentHistory = recentHistory.slice(-10); // Keep the absolute latest 10 turns for manual suggestion history

    if (isUserSpeaker(turn.speaker)) {
      return { ok: true, skipped: 'user-speaker' };
    }

    // Only try to answer if we have collected at least 2 distinct speech turns 
    // since the last time the assistant actually fired, or if this is the very first turn
    if (newlyAccumulatedTurns < 2 && transcriptTurns.length >= 2) {
      return { ok: true, skipped: 'waiting-for-context' };
    }

    return maybeRun();

  }

  async function maybeRun(force = false, isSuggestionRequest = false, requestOptions = {}) {
    const mode = normalizeMode(requestOptions.mode || currentContext.mode || settings.appMode || settings.mode || 'interview');
    const manualPrompt = cleanText(requestOptions.prompt);
    const screenshot = requestOptions.screenshot && requestOptions.screenshot.data ? requestOptions.screenshot : null;
    const screenshotWarning = cleanText(requestOptions.screenshotWarning);
    const selectedSources = normalizeSelectedSources(requestOptions.sources, settings, mode);
    const requestIntent = cleanText(requestOptions.intent);
    const isSayNextRequest = requestIntent === 'say_next';
    const isScreenQuestionRequest = requestIntent === 'screen_question';
    const isCustomPromptRequest = requestIntent === 'custom_prompt';
    const isManualQuestion = !isSayNextRequest && Boolean(manualPrompt || screenshot || screenshotWarning);

    if (!model && provider === 'local') {
      return { ok: true, skipped: 'not-configured' };
    }

    if (!localUrl && provider === 'local') {
      return { ok: true, skipped: 'not-configured' };
    }

    if (!apiKey && provider !== 'local') {
      return { ok: true, skipped: 'not-configured' };
    }

    if (inFlight) {
      return { ok: true, skipped: 'in-flight' };
    }

    const now = Date.now();

    if (!force && now - lastRunAt < intervalMs) {
      return { ok: true, skipped: 'rate-limited' };
    }

    const digest = isSuggestionRequest
      ? recentHistory.slice(-6).map((turn) => `${turn.speaker}: ${turn.text}`).join('\n')
      : transcriptTurns.map((turn) => `${turn.speaker}: ${turn.text}`).join('\n');

    // Only check for unchanged if it's NOT a forced suggestion request
    if (!isSuggestionRequest && (!digest || digest === lastDigest)) {
      return { ok: true, skipped: 'unchanged' };
    }

    inFlight = true;

    try {
      let ragContext = '';
      let targetQuestion = '';
      
      const hasPinecone = !!(settings.ragEnabled && process.env.PINECONE_API_KEY && process.env.PINECONE_HOST);
      const shouldUseRag = selectedSources.includes('rag');
      
      if (isSuggestionRequest) {
        logger.log(`[Intent] Generating suggestion based on recent history...`);
        try {
           const lastTurn = recentHistory[recentHistory.length - 1];
           if (lastTurn && hasPinecone && shouldUseRag) {
             const vectors = await searchResumeVectors(lastTurn.text);
             if (vectors && vectors.length > 0) {
               ragContext = "Relevant facts from the user's resume and past projects:\n" + vectors.map(v => `- ${v.text}`).join('\n');
             }
           }
        } catch (e) {
          logger.error('[RAG] Retrieval error for suggestion:', e);
        }
      } else if (mode === 'meeting') {
        targetQuestion = '';
      } else {
        try {
          const extractedQuestion = await detectResumeQuestion(digest);
          if (extractedQuestion) {
             logger.log(`[Intent] Detected interview-related question in transcript: "${extractedQuestion}"`);
             targetQuestion = extractedQuestion;
             if (hasPinecone && shouldUseRag) {
                 const vectors = await searchResumeVectors(extractedQuestion);
                 if (vectors && vectors.length > 0) {
                   logger.log(`[RAG] Injecting Pinecone context into LM Studio prompt.`);
                   ragContext = "Relevant facts from the user's resume and past projects:\n" + 
                     vectors.map(v => `- ${v.text}`).join('\n');
                 }
             }
          } else {
             logger.log(`[Intent] No interview-related question detected in current transcript window.`);
             inFlight = false;
             // Wait another tick, do not update lastRunAt or lastDigest to allow 
             // the transcript to accumulate more context for the next run
             return { ok: true, skipped: 'no-question' };
          }
        } catch (err) {
          logger.error('[RAG] Intent/retrieval error:', err);
        }
      }

      // If we got this far, a question was found (or it's a forced suggestion request), so we update the timers
      lastRunAt = now;
      lastDigest = digest;

      const command = resolveAssistantCommand({
        mode,
        isSayNextRequest,
        isScreenQuestionRequest,
        isCustomPromptRequest,
        isManualQuestion,
        isSuggestionRequest
      });
      const jsonSchemaProperties = getAssistantSchema(mode, command);
      const systemPrompt = buildAssistantPrompt({
        mode,
        context: currentContext,
        command,
        targetQuestion,
        ragContext
      });

      const userPrompt = buildUserPrompt({
        digest,
        manualPrompt,
        screenshot,
        screenshotWarning,
        selectedSources,
        mode,
        command
      });
      const request = {
        provider,
        apiKey,
        model,
        temperature: 0.2,
        maxTokens,
        axiosClient,
        localUrl,
        jsonSchema: {
          name: 'assistant_cards',
          schema: {
            type: 'object',
            properties: jsonSchemaProperties,
            required: Object.keys(jsonSchemaProperties),
            additionalProperties: false
          }
        },
        messages: [
          {
            role: 'system',
            content: [
              systemPrompt,
              outputShapeFor(mode, command),
              'Include only items that are useful right now. Do not include markdown fences.',
              command === 'assist' && mode === 'interview' ? 'Return one answer card for automatic interview assistance.' : 'Use at most 3 total cards. Keep every value concise. Empty arrays are allowed.',
              'Do not mention that you are an AI.'
            ].filter(Boolean).join(' ')
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        images: screenshot ? [screenshot] : []
      };

      let responseText;
      let imageFallbackWarning = '';

      try {
        responseText = await generateChat(request);
      } catch (error) {
        if (!screenshot) {
          throw error;
        }

        imageFallbackWarning = 'Screenshot was unavailable to the selected model, so Clyde answered from transcript and saved context.';
        responseText = await generateChat({
          ...request,
          images: [],
          messages: [
            request.messages[0],
            {
              role: 'user',
              content: `${userPrompt}\n\n${imageFallbackWarning}`
            }
          ]
        });
      }

      const text = extractAssistantText(responseText);
      const parsedCards = parseAssistantCards(text);
      const cards = command === 'assist' && mode === 'interview'
        ? condenseAutomaticInterviewCards(parsedCards, targetQuestion)
        : command === 'manual_question'
          ? normalizeManualQuestionCards(parsedCards)
          : parsedCards;
      const renderedCards = addWarningToCards(cards, screenshotWarning || imageFallbackWarning);

      if (renderedCards.length) {
        sendUpdate({
          title: 'Live help',
          text,
          cards: renderedCards
        });
        
        // CLEAR the transcript buffer of the current digest so we don't accidentally re-answer these old questions!
        // Because of smart merging, we can't just check text strings. We just empty the array.
        transcriptTurns = [];
        lastDigest = '';
        newlyAccumulatedTurns = 0;
        
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

      return { ok: true, text, cards: renderedCards };
    } catch (error) {
      const message = describeAssistantError(error);
      logger.error('Meeting assistant failed:', message);
      sendStatus({ state: 'warning', message });

      return { ok: false, message, error };
    } finally {
      inFlight = false;
    }
  }

  function requestSuggestion(options = {}) {
    return maybeRun(true, true, options);
  }

  function resetTranscript() {
    transcriptTurns = [];
    lastRunAt = 0;
    lastDigest = '';
    newlyAccumulatedTurns = 0;
  }

  return {
    addTranscript,
    maybeRun,
    requestSuggestion,
    setContext,
    resetTranscript,
    getTranscriptTurns: () => [...transcriptTurns]
  };
}

function extractAssistantText(data) {
  if (!data) {
    return '';
  }

  let content = '';

  if (typeof data === 'string') {
      content = data;
  } else {
      const choice = data.choices && data.choices[0];
      if (choice && choice.message && choice.message.content) {
        content = String(choice.message.content).trim();
      } else if (choice && choice.text) {
        content = String(choice.text).trim();
      } else if (data.output_text) {
        content = String(data.output_text).trim();
      }
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

function resolveAssistantCommand({
  mode,
  isSayNextRequest,
  isScreenQuestionRequest,
  isCustomPromptRequest,
  isManualQuestion,
  isSuggestionRequest
}) {
  if (mode === 'meeting') {
    if (isScreenQuestionRequest) {
      return 'meeting_screen_question';
    }

    if (isSayNextRequest) {
      return 'meeting_say_next';
    }

    if (isCustomPromptRequest || isManualQuestion) {
      return 'meeting_custom_prompt';
    }

    return isSuggestionRequest ? 'meeting_say_next' : 'assist';
  }

  return isSayNextRequest ? 'suggestion' : (isManualQuestion ? 'manual_question' : (isSuggestionRequest ? 'suggestion' : 'assist'));
}

function parseAssistantCards(text) {
  const parsed = parseJsonObject(text);

  if (!parsed) {
    return [];
  }

  const cards = [];

  for (const item of toArray(parsed.screen_descriptions)) {
    const textValue = cleanText(item.text || item.description);

    if (textValue) {
      cards.push({
        type: 'screen_description',
        title: 'Screen',
        body: textValue
      });
    }
  }

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

  for (const item of toArray(parsed.follow_up)) {
    const textValue = cleanText(item.text || item.question);
    const why = cleanText(item.why);

    if (textValue) {
      cards.push({
        type: 'follow_up',
        title: 'Follow-up',
        body: textValue,
        detail: why
      });
    }
  }

  for (const item of toArray(parsed.recaps)) {
    const textValue = cleanText(item.text || item.recap);

    if (textValue) {
      cards.push({
        type: 'recap',
        title: 'Recap',
        body: textValue
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

  for (const item of toArray(parsed.insights)) {
    const textValue = cleanText(item.text || item.insight);

    if (textValue) {
      cards.push({
        type: 'insight',
        title: 'Insight',
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

  for (const item of toArray(parsed.notes)) {
    const textValue = cleanText(item.text || item.note);

    if (textValue) {
      cards.push({
        type: 'note',
        title: 'Note',
        body: textValue
      });
    }
  }

  return cards.slice(0, 4);
}

function condenseAutomaticInterviewCards(cards, targetQuestion = '') {
  const answerCards = cards.filter((card) => card.type === 'answer');
  const sourceCards = answerCards.length ? answerCards : cards;

  if (!sourceCards.length) {
    return [];
  }

  const first = sourceCards[0];
  const question = cleanText(first.question || targetQuestion);
  const bullets = sourceCards
    .flatMap((card) => {
      if (Array.isArray(card.bullets) && card.bullets.length) {
        return card.bullets;
      }

      return [card.body, card.detail];
    })
    .map(cleanText)
    .filter(Boolean)
    .slice(0, 4);

  if (!question && !bullets.length) {
    return [];
  }

  return [{
    ...first,
    id: Buffer.from(question || bullets.join(' ')).toString('base64'),
    type: 'answer',
    title: 'Say next',
    question,
    body: '',
    detail: '',
    bullets
  }];
}

function normalizeManualQuestionCards(cards) {
  return cards.map((card) => {
    if (card.type === 'suggestion' || card.type === 'note') {
      return {
        ...card,
        type: 'answer',
        title: 'Answer'
      };
    }

    return card;
  });
}

function outputShapeFor(mode, command) {
  if (mode === 'meeting' && command === 'meeting_screen_question') {
    return 'Schema: {"screen_descriptions":[{"text":"..."}],"answers":[{"question":"...","bullets":["..."]}]}.';
  }

  if (mode === 'meeting' && command === 'meeting_say_next') {
    return 'Schema: {"suggestions":[{"text":"...","why":"..."}],"insights":[{"text":"..."}]}.';
  }

  if (mode === 'meeting' && command === 'meeting_custom_prompt') {
    return 'Schema: {"answers":[{"question":"...","bullets":["..."]}],"notes":[{"text":"..."}]}.';
  }

  if (command === 'manual_question') {
    return 'Schema: {"suggestions":[{"text":"...","why":"..."}],"notes":[{"text":"..."}]}.';
  }

  if (mode === 'meeting') {
    return 'Schema: {"recaps":[{"text":"..."}],"actions":[{"text":"..."}],"follow_up":[{"text":"...","why":"..."}],"suggestions":[{"text":"..."}],"notes":[{"text":"..."}]}.';
  }

  if (command === 'suggestion') {
    return 'Schema: {"suggestions":[{"text":"..."}]}.';
  }

  return 'Schema: {"answers":[{"question":"...","bullets":["..."]}]}.';
}

function buildUserPrompt({ digest, manualPrompt, screenshot, screenshotWarning, selectedSources = [], mode = 'interview', command = 'assist' }) {
  const lines = [
    `Transcript:\n${digest || 'No transcript turns captured yet.'}`
  ];

  if (selectedSources.length) {
    lines.push(`Selected sources: ${selectedSources.join(', ')}`);
  }

  if (mode === 'meeting' && command === 'meeting_screen_question') {
    lines.push(`Screen question:\n${manualPrompt || 'No written question provided.'}`);
    if (screenshot) {
      lines.push('A current desktop screenshot is attached. Describe the attached screen first, then answer or comment on the screen question.');
    }
  } else if (mode === 'meeting' && command === 'meeting_say_next') {
    lines.push('Create one Suggestions card with useful things the user can say next and one Insights card with important context from the transcript.');
  } else if (mode === 'meeting' && command === 'meeting_custom_prompt') {
    lines.push(`Custom prompt:\n${manualPrompt}`);
    if (screenshot) {
      lines.push('A current desktop screenshot is attached because the user selected Include screenshot.');
    }
    lines.push('Follow the custom prompt exactly. Use the selected sources listed above when relevant.');
  } else {
    if (manualPrompt) {
      lines.push(`User question:\n${manualPrompt}`);
    }

    if (screenshot) {
      lines.push('A current desktop screenshot is attached. Use it only when it helps answer the user question.');
    }

    lines.push(manualPrompt
      ? 'Create cards that answer the user question and help me respond right now.'
      : 'Create cards that help me respond to the other people.');
  }

  if (screenshotWarning) {
    lines.push(screenshotWarning);
  }

  return lines.join('\n\n');
}

function normalizeSelectedSources(sourceOptions = {}, settings = {}, mode = 'interview') {
  const normalizedMode = normalizeMode(mode);
  const sourceMap = {
    resume: normalizedMode === 'interview' && Boolean(sourceOptions.resume),
    memory: normalizedMode === 'meeting' && Boolean(sourceOptions.memory),
    rag: Boolean(sourceOptions.rag) && Boolean(settings.ragEnabled),
    web: Boolean(sourceOptions.web)
  };

  const active = Object.keys(sourceMap).filter((key) => sourceMap[key]);
  if (active.length) {
    return active;
  }

  if (settings.ragEnabled) {
    return ['rag'];
  }

  return normalizedMode === 'meeting' ? ['memory'] : ['resume'];
}

function addWarningToCards(cards, warning) {
  if (!warning || !cards.length) {
    return cards;
  }

  return cards.map((card, index) => index === 0
    ? { ...card, detail: [card.detail, warning].filter(Boolean).join(' ') }
    : card);
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
  normalizeSelectedSources,
  outputShapeFor,
  parseAssistantCards
};
