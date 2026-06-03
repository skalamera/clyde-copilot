const { detectResumeQuestion, extractLikelyInterviewQuestion, searchKnowledgeVectors } = require('./pineconeClient');
const { generateChat } = require('./llmClient');
const { buildAssistantPrompt, getAssistantSchema, normalizeMode } = require('./assistantPrompts');
const { createProRealtimeAgent } = require('./proRealtimeAgent');

const DEFAULT_INTERVAL_MS = 30000;
const DEFAULT_MAX_TURNS = 10;
const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_MAX_TOKENS = 1500;
const DEFAULT_UTTERANCE_SETTLE_MS = 0;
const DEFAULT_INCOMPLETE_UTTERANCE_SETTLE_MS = 1400;
const PRO_INTERVIEWER_PROMPT_GAP_MS = 10000;
const PRO_RECENT_DISPLAYED_QUESTION_TTL_MS = 30000;

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
  const debugTrace = typeof options.debugTrace === 'function' ? options.debugTrace : () => {};
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const utteranceSettleMs = Math.max(0, Number(options.utteranceSettleMs ?? DEFAULT_UTTERANCE_SETTLE_MS) || 0);
  const incompleteUtteranceSettleMs = Math.max(
    utteranceSettleMs,
    Number(options.incompleteUtteranceSettleMs ?? DEFAULT_INCOMPLETE_UTTERANCE_SETTLE_MS) || DEFAULT_INCOMPLETE_UTTERANCE_SETTLE_MS
  );
  const proFinalMemoryWaitMs = Math.max(0, Number(options.proFinalMemoryWaitMs ?? 350) || 0);
  const proMemorySearchIntervalMs = Number(options.proMemorySearchIntervalMs ?? 15000) || 15000;
  const proAgent = options.proAgent || createProRealtimeAgent({
    settings,
    knowledgeManager: options.knowledgeManager,
    logger,
    sendStatus,
    sendUpdate,
    debugTrace,
    timeoutMs: options.proAgentTimeoutMs || timeout
  });

  let transcriptTurns = [];
  let recentHistory = [];
  let intentTurns = [];
  let pendingIntentUtterance = null;
  let intentSettleTimer = null;
  let nextIntentTurnId = 1;
  let lastRunAt = 0;
  let lastProMemorySearchAt = 0;
  let inFlight = false;
  let rerunAfterInFlight = false;
  let lastDigest = '';
  let currentContext = {};
  let newlyAccumulatedTurns = 0;
  let queuedForcedRun = null;
  let lastAutomaticTargetQuestion = '';
  const partialQuestionGate = new Map();
  const partialQuestionTimers = new Map();
  const latestProRunTextByGroup = new Map();
  const displayedProRunTextByGroup = new Map();
  let recentDisplayedProRuns = [];
  let proInterviewerPromptHistory = [];
  let lastProInterviewerPromptAt = 0;

  function setContext(context) {
    if (context) {
      currentContext = context;
      if (proAgent && typeof proAgent.setContext === 'function') {
        proAgent.setContext(context);
      }
    }
  }

  async function addTranscript(turn) {
    if (!turn || !turn.text) {
      return { ok: true, skipped: 'empty' };
    }

    const speaker = turn.speaker || 'Unknown';
    const text = String(turn.text).trim();
    trace('assistant.transcript.final.received', {
      speaker,
      text,
      itemId: turn.itemId || '',
      provider: turn.provider || ''
    });

    if (shouldUseProAgent(settings, {}) && !options.testProIntent) {
      const finalGateResult = handleProFinalTranscriptGate({ ...turn, speaker, text });
      if (finalGateResult?.handled) {
        trace('assistant.transcript.final.handled_by_pro_gate', finalGateResult);
        return finalGateResult;
      }
    }

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

    if (shouldUseProAgent(settings, {}) && !options.testProIntent) {
      // For Pro, we let the server-side VAD on the audio stream trigger automatic responses.
      // We do not run client-side text/intent triggers on incoming transcription turns.
      trace('assistant.transcript.final.skip', { reason: 'pro-server-side' });
      return { ok: true, skipped: 'pro-server-side' };
    }

    if (isUserSpeaker(turn.speaker)) {
      clearPendingIntentUtterance();
      appendIntentTurn(speaker, text);
      return { ok: true, skipped: 'user-speaker' };
    }

    const intentReady = queueInterviewerIntentUtterance(speaker, text);
    if (!intentReady) {
      return { ok: true, skipped: 'waiting-for-utterance' };
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
    const isInterviewerQuestionsRequest = requestIntent === 'interviewer_questions';
    const isManualQuestion = !isSayNextRequest && Boolean(manualPrompt || screenshot || screenshotWarning);
    const proCandidate = shouldUseProAgent(settings, { screenshot });

    let requestProvider = provider;
    let requestApiKey = apiKey;
    let requestModel = model;
    let requestLocalUrl = localUrl;

    if (settings.userTier === 'pro') {
      if (!proCandidate) {
        if (provider === 'openai') {
          requestProvider = 'openai';
          requestApiKey = settings.transcriptionApiKey || settings.openAiApiKey || process.env.OPENAI_API_KEY || apiKey;
          requestModel = settings.llmModel || 'gpt-4o';
        }
      } else if (!requestApiKey) {
        requestApiKey = settings.transcriptionApiKey || settings.openAiApiKey || process.env.OPENAI_API_KEY;
        if (requestProvider === 'local') {
          requestProvider = 'openai';
          requestModel = settings.llmModel || 'gpt-4o';
        }
      }
    }

    if (!proCandidate && !requestModel && requestProvider === 'local') {
      return { ok: true, skipped: 'not-configured' };
    }

    if (!proCandidate && !localUrl && provider === 'local') {
      return { ok: true, skipped: 'not-configured' };
    }

    if (!proCandidate && !apiKey && provider !== 'local') {
      return { ok: true, skipped: 'not-configured' };
    }

    if (inFlight) {
      if (force && requestOptions.draftCardId) {
        const duplicateDisplayedRun = getDuplicateDisplayedProRun(requestOptions);
        if (duplicateDisplayedRun) {
          trace('assistant.run.skip_duplicate_forced', {
            draftCardId: requestOptions.draftCardId,
            groupId: requestOptions.groupId,
            targetQuestion: requestOptions.targetQuestion || '',
            displayedQuestion: duplicateDisplayedRun.text,
            displayedGroupId: duplicateDisplayedRun.groupId
          });
          return { ok: true, skipped: 'duplicate-forced-run' };
        }

        const nextQueuedRun = {
          isSuggestionRequest,
          requestOptions
        };
        if (!queuedForcedRun || shouldReplaceQueuedForcedRun(queuedForcedRun.requestOptions, requestOptions)) {
          queuedForcedRun = nextQueuedRun;
        }
        trace('assistant.run.queued_forced', {
          draftCardId: requestOptions.draftCardId,
          groupId: requestOptions.groupId,
          targetQuestion: requestOptions.targetQuestion || '',
          replacedQueuedRun: queuedForcedRun === nextQueuedRun
        });
      }

      if (!force && !isSuggestionRequest) {
        rerunAfterInFlight = true;
      }

      trace('assistant.run.skip', { reason: 'in-flight' });
      return { ok: true, skipped: 'in-flight' };
    }

    const suppliedTranscriptDigest = transcriptDigest(requestOptions.transcript);
    const digest = suppliedTranscriptDigest
      ? suppliedTranscriptDigest
      : isSuggestionRequest
          ? recentHistory.slice(-6).map((turn) => `${turn.speaker}: ${turn.text}`).join('\n')
          : intentTurns.map((turn) => `${turn.speaker}: ${turn.text}`).join('\n');
    const digestMaxIntentTurnId = getMaxIntentTurnId(intentTurns);
    const now = Date.now();
    const automaticInterviewRequest = isAutomaticInterviewAssist(mode, isSuggestionRequest, isManualQuestion);
    const promptCompletion = classifyProGatePrompt(digest);
    const localCompleteQuestion = automaticInterviewRequest && !proCandidate
      ? cleanText(extractLikelyInterviewQuestion(digest) || (promptCompletion.complete && promptCompletion.hasStrongTerminal ? extractLatestInterviewerPrompt(digest) : ''))
      : '';
    const canBypassRateLimitForNewQuestion = Boolean(
      localCompleteQuestion
      && (!lastAutomaticTargetQuestion || !isSameOrNearDuplicateQuestion(lastAutomaticTargetQuestion, localCompleteQuestion))
    );

    if (!proCandidate && !force && now - lastRunAt < intervalMs && !canBypassRateLimitForNewQuestion) {
      trace('assistant.run.skip', {
        reason: 'rate-limited',
        intervalMs,
        elapsedMs: now - lastRunAt,
        latestQuestion: localCompleteQuestion,
        lastAutomaticTargetQuestion
      });
      return { ok: true, skipped: 'rate-limited' };
    }

    // Only check for unchanged if it's NOT a forced suggestion request
    if (!isSuggestionRequest && (!digest || digest === lastDigest)) {
      trace('assistant.run.skip', { reason: 'unchanged', digest });
      return { ok: true, skipped: 'unchanged' };
    }

    inFlight = true;
    trace('assistant.run.start', {
      force,
      isSuggestionRequest,
      mode,
      commandPreview: requestIntent,
      digest,
      manualPrompt,
      selectedSources,
      llmProvider: settings.llmProvider || 'local',
      transcriptionProvider: settings.transcriptionProvider || 'local',
      gptRealtimeUsed: !!proCandidate
    });

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
             const vectors = await searchKnowledgeVectors(lastTurn.text, settings, { topK: 3 });
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
        const localInterviewQuestion = proCandidate && automaticInterviewRequest && typeof extractLikelyInterviewQuestion === 'function'
          ? extractLikelyInterviewQuestion(digest)
          : localCompleteQuestion;

        if (automaticInterviewRequest && !localInterviewQuestion && !hasLikelyCompleteInterviewerPrompt(digest)) {
          logger.log(`[Intent] Waiting for a complete interviewer question before generating an answer card. Latest prompt: "${extractLatestInterviewerPrompt(digest).slice(0, 240)}"`);
          inFlight = false;
          return { ok: true, skipped: 'waiting-for-complete-question' };
        }

        if (proCandidate && isAutomaticInterviewAssist(mode, isSuggestionRequest, isManualQuestion)) {
          targetQuestion = cleanText(requestOptions.targetQuestion) || localInterviewQuestion || extractLatestInterviewerPrompt(digest);
          logger.log(`[Intent] Sending complete interviewer prompt directly to Clyde Pro: "${targetQuestion.slice(0, 240)}"`);
          trace('assistant.intent.target_question', { targetQuestion, source: 'pro-local-complete-prompt' });
        } else if (automaticInterviewRequest && localInterviewQuestion) {
          targetQuestion = localInterviewQuestion;
          logger.log(`[Intent] Using latest complete interviewer question: "${targetQuestion.slice(0, 240)}"`);
          trace('assistant.intent.target_question', { targetQuestion, source: 'local-complete-prompt' });
          if (hasPinecone && shouldUseRag) {
            try {
              const vectors = await searchKnowledgeVectors(targetQuestion, settings, { topK: 3 });
              if (vectors && vectors.length > 0) {
                logger.log(`[RAG] Injecting Pinecone context into LM Studio prompt.`);
                ragContext = "Relevant facts from the user's resume and past projects:\n" +
                  vectors.map(v => `- ${v.text}`).join('\n');
              }
            } catch (e) {
              logger.error('[RAG] Retrieval error for complete local question:', e);
            }
          }
        } else {
          try {
            const extractedQuestion = await detectResumeQuestion(digest);
            if (extractedQuestion) {
              logger.log(`[Intent] Detected interview-related question in transcript: "${extractedQuestion}"`);
              targetQuestion = extractedQuestion;
              if (hasPinecone && shouldUseRag) {
                const vectors = await searchKnowledgeVectors(extractedQuestion, settings, { topK: 3 });
                if (vectors && vectors.length > 0) {
                  logger.log(`[RAG] Injecting Pinecone context into LM Studio prompt.`);
                  ragContext = "Relevant facts from the user's resume and past projects:\n" +
                    vectors.map(v => `- ${v.text}`).join('\n');
                }
              }
            } else if (proCandidate) {
              if (!hasLikelyCompleteInterviewerPrompt(digest)) {
                logger.log(`[Intent] Waiting for a complete interviewer question before sending to Clyde Pro. Latest prompt: "${extractLatestInterviewerPrompt(digest).slice(0, 240)}"`);
                inFlight = false;
                return { ok: true, skipped: 'waiting-for-complete-question' };
              }

              logger.log(`[Intent] No explicit interview question detected; sending complete settled turn to Clyde Pro.`);
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
      }

      // If we got this far, a question was found (or it's a forced suggestion request), so we update the timers
      lastRunAt = now;
      lastDigest = digest;
      if (automaticInterviewRequest && targetQuestion) {
        lastAutomaticTargetQuestion = targetQuestion;
      }

      const command = resolveAssistantCommand({
        mode,
        isSayNextRequest,
        isScreenQuestionRequest,
        isCustomPromptRequest,
        isInterviewerQuestionsRequest,
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
        provider: requestProvider,
        apiKey: requestApiKey,
        model: requestModel,
        temperature: 0.2,
        maxTokens,
        axiosClient,
        localUrl: requestLocalUrl,
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

      const allowMemorySearch = shouldAllowProMemorySearch({
        now,
        isManualQuestion,
        isSuggestionRequest,
        lastProMemorySearchAt,
        proMemorySearchIntervalMs
      });

      let pendingDraftCardId = '';
      let pendingDraftGroupId = '';
      let memorySearchStarted = false;
      const memorySearchPromise = proCandidate && allowMemorySearch && typeof proAgent.searchMemoryCards === 'function'
        ? startProMemorySearch({
            query: targetQuestion || manualPrompt || digest,
            digest,
            manualPrompt,
            mode,
            context: currentContext,
            allowMemorySearch
          })
        : null;

      if (memorySearchPromise) {
        memorySearchStarted = true;
        lastProMemorySearchAt = now;
      }

      if (proCandidate) {
        try {
          const proGroupId = requestOptions.groupId || `pro-${now}-${Math.random().toString(16).slice(2)}`;
          const proDraftCardId = requestOptions.draftCardId || `${proGroupId}-draft`;
          let proDraftShown = false;
          let shownDraftCards = [];
          pendingDraftCardId = proDraftCardId;
          pendingDraftGroupId = proGroupId;
          const proResult = await proAgent.run({
            digest,
            manualPrompt,
            mode,
            command,
            context: currentContext,
            targetQuestion,
            selectedSources,
            allowMemorySearch: false,
            toolsEnabled: false,
            reasoningEffort: 'low',
            groupId: proGroupId,
            draftCardId: proDraftCardId,
            onDraft: (draft) => {
              const latestTargetQuestion = latestProRunTextByGroup.get(proGroupId) || '';
              if (isStaleProRun(latestTargetQuestion, targetQuestion)) {
                trace('assistant.pro.skip_stale_draft', {
                  groupId: proGroupId,
                  draftCardId: proDraftCardId,
                  targetQuestion,
                  latestTargetQuestion
                });
                return;
              }

              const draftCards = Array.isArray(draft?.cards) ? draft.cards : [];
              if (!draftCards.length) {
                return;
              }

              proDraftShown = true;
              shownDraftCards = draftCards;
              rememberDisplayedProRun(proGroupId, targetQuestion);
              sendUpdate({
                title: 'Draft answer',
                text: draft.text || '',
                cards: draftCards,
                replaceCardId: proDraftCardId,
                groupId: proGroupId
              });
            }
          });
          const latestTargetQuestion = latestProRunTextByGroup.get(proGroupId) || '';
          if (isStaleProRun(latestTargetQuestion, targetQuestion)) {
            trace('assistant.pro.skip_stale_result', {
              groupId: proGroupId,
              draftCardId: proDraftCardId,
              targetQuestion,
              latestTargetQuestion
            });
            return { ok: true, skipped: 'stale-pro-run' };
          }

          const quickMemory = await waitForMemoryResult(memorySearchPromise, proFinalMemoryWaitMs);
          const enrichedResult = quickMemory?.contextText
            ? await runMemoryEnrichedFinal({
                digest,
                manualPrompt,
                mode,
                command,
                context: currentContext,
                targetQuestion,
                selectedSources,
                groupId: proGroupId,
                draftCardId: proDraftCardId,
                memoryContext: quickMemory.contextText
              }).catch((error) => {
                logger.warn?.('Memory-enriched final answer failed:', describeAssistantError(error));
                return null;
              })
            : null;
          const finalProResult = enrichedResult || proResult;
          let proCards = Array.isArray(finalProResult?.cards) ? finalProResult.cards.filter((card) => card.type !== 'memory') : [];
          trace('assistant.pro.result', {
            text: finalProResult?.text || '',
            cardCount: proCards.length,
            cards: proCards,
            groupId: finalProResult?.groupId || proGroupId,
            draftCardId: finalProResult?.draftCardId || proDraftCardId,
            toolCalls: finalProResult?.toolCalls || 0
          });
          if (mode === 'interview' && (isSayNextRequest || isScreenQuestionRequest)) {
            proCards = proCards.slice(0, 1);
          }

          if (proDraftShown) {
            const reconciledCards = reconcileDraftAndFinalCards(shownDraftCards, proCards);
            if (!reconciledCards.length) {
              trace('assistant.pro.skip_final_replace', {
                reason: 'final-too-similar-to-draft',
                groupId: finalProResult?.groupId || proGroupId,
                draftCardId: finalProResult?.draftCardId || proDraftCardId
              });
              if (quickMemory?.cards?.length) {
                sendMemoryUpdate(quickMemory.cards);
              } else if (memorySearchPromise) {
                memorySearchPromise.then((memoryResult) => {
                  if (memoryResult?.cards?.length) {
                    sendMemoryUpdate(memoryResult.cards);
                  }
                }).catch((error) => logger.warn?.('Deferred memory update failed:', describeAssistantError(error)));
              }
              transcriptTurns = [];
              intentTurns = intentTurns.filter((turn) => turn.id > digestMaxIntentTurnId);
              lastDigest = '';
              newlyAccumulatedTurns = 0;
              sendStatus({ state: 'capturing', message: 'Meeting assistant updated.' });
              return { ok: true, text: finalProResult.text || '', cards: shownDraftCards };
            }
            proCards = reconciledCards;
          }

          if ((finalProResult?.toolCalls || memorySearchStarted) && allowMemorySearch) {
            lastProMemorySearchAt = now;
          }

          if (proCards.length) {
            trace('assistant.pro.send_cards', { cards: proCards, groupId: finalProResult.groupId || proGroupId });
            rememberDisplayedProRun(finalProResult.groupId || proGroupId, targetQuestion);
            sendUpdate({
              title: 'Live help',
              text: finalProResult.text || '',
              cards: proCards,
              replaceCardId: proDraftShown ? proDraftCardId : '',
              groupId: finalProResult.groupId || proGroupId
            });

            if (quickMemory?.cards?.length) {
              sendMemoryUpdate(quickMemory.cards);
            } else if (memorySearchPromise) {
              memorySearchPromise.then((memoryResult) => {
                if (memoryResult?.cards?.length) {
                  sendMemoryUpdate(memoryResult.cards);
                }
              }).catch((error) => logger.warn?.('Deferred memory update failed:', describeAssistantError(error)));
            }

            transcriptTurns = [];
            intentTurns = intentTurns.filter((turn) => turn.id > digestMaxIntentTurnId);
            lastDigest = '';
            newlyAccumulatedTurns = 0;
            sendStatus({ state: 'capturing', message: 'Meeting assistant updated.' });
            return { ok: true, text: finalProResult.text || '', cards: proCards };
          }
        } catch (error) {
          logger.error('Clyde Pro agent failed:', describeAssistantError(error));
          trace('assistant.pro.error', { message: describeAssistantError(error) });
          sendStatus({ state: 'warning', message: 'Pro agent unavailable; using local assistant fallback.' });
        }
      }

      if (!isFreeAssistantConfigured({ provider: requestProvider, model: requestModel, localUrl: requestLocalUrl, apiKey: requestApiKey })) {
        sendStatus({ state: 'warning', message: 'Local assistant fallback is not configured.' });
        return { ok: false, message: 'Local assistant fallback is not configured.' };
      }

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
      let cards = command === 'assist' && mode === 'interview'
        ? condenseAutomaticInterviewCards(parsedCards, targetQuestion)
        : command === 'manual_question'
          ? normalizeManualQuestionCards(parsedCards)
          : parsedCards;
      if (mode === 'interview' && (isSayNextRequest || isScreenQuestionRequest)) {
        cards = cards.slice(0, 1);
      }
      const renderedCards = addWarningToCards(cards, screenshotWarning || imageFallbackWarning);

      if (renderedCards.length) {
        trace('assistant.fallback.send_cards', { cards: renderedCards });
        sendUpdate({
          title: 'Live help',
          text,
          cards: renderedCards,
          replaceCardId: pendingDraftCardId,
          groupId: pendingDraftGroupId
        });
        
        // CLEAR the transcript buffer of the current digest so we don't accidentally re-answer these old questions!
        // Because of smart merging, we can't just check text strings. We just empty the array.
        transcriptTurns = [];
        intentTurns = intentTurns.filter((turn) => turn.id > digestMaxIntentTurnId);
        lastDigest = '';
        newlyAccumulatedTurns = 0;
        
        sendStatus({ state: 'capturing', message: 'Meeting assistant updated.' });
      } else if (text) {
        logger.log('Ignored non-JSON assistant response or empty array:', text);
        trace('assistant.fallback.ignored', { text });
        // Fast retry: The model failed to answer the question, so we reset the timers to let it try again on the next audio chunk
        lastRunAt = 0;
        lastDigest = '';
        sendStatus({ state: 'warning', message: 'Model returned empty answers. Will auto-retry...' });
      } else {
        trace('assistant.fallback.empty', { message: 'LM Studio or provider returned an empty assistant message.' });
        sendStatus({
          state: 'warning',
          message: 'LM Studio returned an empty assistant message. Increase LM_STUDIO_ASSISTANT_MAX_TOKENS or disable model reasoning.'
        });
      }

      return { ok: true, text, cards: renderedCards };
    } catch (error) {
      const message = describeAssistantError(error);
      logger.error('Meeting assistant failed:', message);
      trace('assistant.run.error', { message });
      sendStatus({ state: 'warning', message });

      return { ok: false, message, error };
    } finally {
      inFlight = false;

      if (queuedForcedRun) {
        const queued = queuedForcedRun;
        queuedForcedRun = null;
        const duplicateDisplayedRun = getDuplicateDisplayedProRun(queued.requestOptions);
        if (duplicateDisplayedRun) {
          trace('assistant.run.skip_queued_forced_duplicate', {
            draftCardId: queued.requestOptions?.draftCardId || '',
            groupId: queued.requestOptions?.groupId || '',
            targetQuestion: queued.requestOptions?.targetQuestion || '',
            displayedQuestion: duplicateDisplayedRun.text,
            displayedGroupId: duplicateDisplayedRun.groupId
          });
        } else {
          setTimeout(() => {
            maybeRun(true, queued.isSuggestionRequest, queued.requestOptions).catch((error) => {
              logger.error('Queued forced meeting assistant run failed:', describeAssistantError(error));
            });
          }, 0);
        }
      }

      if (rerunAfterInFlight) {
        rerunAfterInFlight = false;
        setTimeout(() => {
          maybeRun(true).catch((error) => {
            logger.error('Queued meeting assistant run failed:', describeAssistantError(error));
          });
        }, 0);
      }
    }
  }

  function requestSuggestion(options = {}) {
    return maybeRun(true, true, options);
  }

  function addPartialTranscript(turn) {
    if (!turn || !turn.partial || !turn.text || !shouldUseProAgent(settings, {}) || options.testProIntent) {
      trace('assistant.transcript.partial.skip', {
        reason: 'partial-ignored',
        hasText: Boolean(turn?.text),
        partial: Boolean(turn?.partial)
      });
      return { ok: true, skipped: 'partial-ignored' };
    }

    const mode = normalizeMode(currentContext.mode || settings.appMode || settings.mode || 'interview');
    if (mode !== 'interview' || isUserSpeaker(turn.speaker)) {
      trace('assistant.transcript.partial.skip', {
        reason: 'partial-not-interviewer',
        mode,
        speaker: turn.speaker || ''
      });
      return { ok: true, skipped: 'partial-not-interviewer' };
    }

    const itemId = cleanText(turn.itemId) || `partial-${Date.now()}`;
    const text = cleanText(turn.text);
    resetStaleProPromptHistory();
    const resolvedText = resolveProGateQuestion(text);
    const promptCompletion = classifyProGatePrompt(resolvedText);
    if (!resolvedText || !promptCompletion.complete) {
      const priorTimer = partialQuestionTimers.get(itemId);
      if (priorTimer) {
        clearTimeout(priorTimer);
        partialQuestionTimers.delete(itemId);
      }

      trace('assistant.pro_gate.partial.waiting', {
        speaker: turn.speaker || '',
        itemId: turn.itemId || '',
        text,
        resolvedText,
        hasCompletePrompt: Boolean(promptCompletion.complete),
        reason: promptCompletion.reason
      });
      return { ok: true, skipped: 'partial-waiting-for-question' };
    }

    const existing = partialQuestionGate.get(itemId) || {
      itemId,
      groupId: `pro-partial-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      draftCardId: '',
      lastText: '',
      triggered: false
    };
    existing.draftCardId = existing.draftCardId || `${existing.groupId}-draft`;
    existing.speaker = turn.speaker || 'Interviewer';
    existing.text = resolvedText;
    partialQuestionGate.set(itemId, existing);

    if (resolvedText === existing.lastText && existing.triggered) {
      return { ok: true, skipped: 'partial-unchanged' };
    }

    const priorTimer = partialQuestionTimers.get(itemId);
    if (priorTimer) {
      clearTimeout(priorTimer);
    }

    const queueDelayMs = promptCompletion.hasStrongTerminal ? 180 : 1200;
    const timer = setTimeout(() => {
      partialQuestionTimers.delete(itemId);
      trace('assistant.pro_gate.partial.fire', {
        itemId,
        text: existing.text,
        groupId: existing.groupId,
        draftCardId: existing.draftCardId
      });
      runProPartialGate(existing, false).catch((error) => {
        logger.error('Partial Pro question gate failed:', describeAssistantError(error));
      });
    }, queueDelayMs);
    partialQuestionTimers.set(itemId, timer);

    trace('assistant.pro_gate.partial.queued', {
      itemId,
      text,
      resolvedText,
      groupId: existing.groupId,
      draftCardId: existing.draftCardId,
      queueDelayMs,
      reason: promptCompletion.reason
    });
    return { ok: true, queued: 'partial-question-gate' };
  }

  function handleProFinalTranscriptGate(turn) {
    const itemId = cleanText(turn.itemId);
    const gate = itemId ? partialQuestionGate.get(itemId) : null;
    const finalText = cleanText(turn.text);
    if (!finalText) {
      return null;
    }

    if (isUserSpeaker(turn.speaker)) {
      if (!isTinyUserFiller(finalText)) {
        clearProPromptHistory();
      }
      trace('assistant.pro_gate.final.received', {
        itemId,
        speaker: turn.speaker || '',
        finalText,
        resolvedFinalText: '',
        hasGate: Boolean(gate),
        skipped: 'user-speaker'
      });
      return null;
    }

    resetStaleProPromptHistory();
    const resolvedFinalText = resolveProGateQuestion(finalText);
    const promptCompletion = classifyProGatePrompt(resolvedFinalText);
    appendProInterviewerPrompt(turn.speaker, finalText);
    trace('assistant.pro_gate.final.received', {
      itemId,
      speaker: turn.speaker || '',
      finalText,
      resolvedFinalText,
      hasGate: Boolean(gate),
      hasCompletePrompt: Boolean(promptCompletion.complete),
      reason: promptCompletion.reason
    });

    if (!gate) {
      if (!resolvedFinalText || !promptCompletion.complete) {
        return null;
      }

      const finalGate = {
        itemId: itemId || `final-${Date.now()}`,
        groupId: `pro-final-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        draftCardId: '',
        speaker: turn.speaker || 'Interviewer',
        text: resolvedFinalText,
        lastText: '',
        triggered: false
      };
      finalGate.draftCardId = `${finalGate.groupId}-draft`;
      runProPartialGate(finalGate, true).catch((error) => {
        logger.error('Final Pro question gate failed:', describeAssistantError(error));
      });
      trace('assistant.pro_gate.final.queued', {
        itemId: finalGate.itemId,
        text: finalGate.text,
        groupId: finalGate.groupId,
        draftCardId: finalGate.draftCardId
      });
      return { ok: true, handled: true, queued: 'pro-final-question-gate' };
    }

    const timer = partialQuestionTimers.get(itemId);
    if (timer) {
      clearTimeout(timer);
      partialQuestionTimers.delete(itemId);
    }

    partialQuestionGate.delete(itemId);

    if (resolvedFinalText !== gate.lastText && promptCompletion.complete) {
      gate.text = resolvedFinalText;
      runProPartialGate(gate, true).catch((error) => {
        logger.error('Final Pro question gate failed:', describeAssistantError(error));
      });
      trace('assistant.pro_gate.final.queued', {
        itemId,
        text: gate.text,
        groupId: gate.groupId,
        draftCardId: gate.draftCardId
      });
      return { ok: true, handled: true, queued: 'pro-final-question-gate' };
    }

    return null;
  }

  async function runProPartialGate(gate, forceFinal) {
    const text = cleanProTargetQuestion(gate.text);
    if (!text || (!forceFinal && text === gate.lastText && gate.triggered)) {
      return { ok: true, skipped: 'partial-unchanged' };
    }

    const latestText = latestProRunTextByGroup.get(gate.groupId) || '';
    if (isStaleProRun(latestText, text)) {
      trace('assistant.pro_gate.skip_stale_run', {
        forceFinal,
        text,
        latestText,
        groupId: gate.groupId,
        draftCardId: gate.draftCardId
      });
      return { ok: true, skipped: 'stale-pro-run' };
    }

    gate.lastText = text;
    gate.triggered = true;
    if (shouldReplaceLatestProRunText(latestText, text)) {
      latestProRunTextByGroup.set(gate.groupId, text);
    }
    trace('assistant.pro_gate.run', {
      forceFinal,
      text,
      groupId: gate.groupId,
      draftCardId: gate.draftCardId
    });

    const result = await maybeRun(true, false, {
      mode: 'interview',
      transcript: [{ speaker: gate.speaker || 'Interviewer', text }],
      targetQuestion: text,
      groupId: gate.groupId,
      draftCardId: gate.draftCardId
    });
    clearProPromptHistoryIfUnchanged(text);
    return result;
  }

  function resolveProGateQuestion(text) {
    const current = stripTrailingAcknowledgement(cleanText(text));
    if (!current) {
      return '';
    }

    const previous = getRecentProInterviewerPrompt();

    if (!isShortFollowUpPrompt(current)) {
      return shouldMergeIntoPriorProPrompt(previous, current)
        ? mergeUtteranceText(previous, current)
        : current;
    }

    if (!previous || normalizeUtteranceText(previous).toLowerCase() === normalizeUtteranceText(current).toLowerCase()) {
      return current;
    }

    return mergeUtteranceText(previous, current);
  }

  function appendProInterviewerPrompt(speaker, text) {
    resetStaleProPromptHistory();
    const value = cleanText(text);
    if (!value || isUserSpeaker(speaker)) {
      return;
    }

    const previous = proInterviewerPromptHistory[proInterviewerPromptHistory.length - 1] || '';
    const next = shouldMergeIntoPriorProPrompt(previous, value)
      ? mergeUtteranceText(previous, value)
      : value;

    if (next === previous) {
      return;
    }

    if (shouldMergeIntoPriorProPrompt(previous, value)) {
      proInterviewerPromptHistory = [...proInterviewerPromptHistory.slice(0, -1), next].slice(-4);
    } else {
      proInterviewerPromptHistory = [...proInterviewerPromptHistory, next].slice(-4);
    }
    lastProInterviewerPromptAt = Date.now();
  }

  function getRecentProInterviewerPrompt() {
    return proInterviewerPromptHistory[proInterviewerPromptHistory.length - 1] || '';
  }

  function clearProPromptHistory() {
    proInterviewerPromptHistory = [];
    lastProInterviewerPromptAt = 0;
  }

  function clearProPromptHistoryIfUnchanged(completedText) {
    const latest = getRecentProInterviewerPrompt();
    const normalizedLatest = normalizeUtteranceText(latest).toLowerCase();
    const normalizedCompleted = normalizeUtteranceText(completedText).toLowerCase();
    if (!latest
      || normalizedLatest === normalizedCompleted
      || normalizedCompleted.startsWith(`${normalizedLatest} `)
      || textSimilarity(latest, completedText) >= 0.72) {
      clearProPromptHistory();
      return;
    }

    trace('assistant.pro_gate.keep_pending_history', {
      completedText,
      pendingText: latest
    });
  }

  function rememberDisplayedProRun(groupId, targetQuestion) {
    const normalizedGroupId = cleanText(groupId);
    const normalizedQuestion = normalizeUtteranceText(targetQuestion);
    if (!normalizedGroupId || !normalizedQuestion) {
      return;
    }

    displayedProRunTextByGroup.set(normalizedGroupId, normalizedQuestion);
    pruneRecentDisplayedProRuns();
    recentDisplayedProRuns = [
      ...recentDisplayedProRuns.filter((run) => run.groupId !== normalizedGroupId),
      {
        groupId: normalizedGroupId,
        text: normalizedQuestion,
        at: Date.now()
      }
    ].slice(-12);
  }

  function getDuplicateDisplayedProRun(requestOptions = {}) {
    const groupId = cleanText(requestOptions.groupId);
    const targetQuestion = normalizeUtteranceText(requestOptions.targetQuestion);
    const displayedQuestion = normalizeUtteranceText(displayedProRunTextByGroup.get(groupId));
    if (!groupId || !targetQuestion) {
      return null;
    }

    if (displayedQuestion && isSameOrNearDuplicateQuestion(displayedQuestion, targetQuestion)) {
      return {
        groupId,
        text: displayedQuestion
      };
    }

    pruneRecentDisplayedProRuns();
    return recentDisplayedProRuns.find((run) => (
      run.groupId !== groupId
      && isDuplicateRecentDisplayedQuestion(run.text, targetQuestion)
    )) || null;
  }

  function pruneRecentDisplayedProRuns() {
    const cutoff = Date.now() - PRO_RECENT_DISPLAYED_QUESTION_TTL_MS;
    recentDisplayedProRuns = recentDisplayedProRuns.filter((run) => run.at >= cutoff);
  }

  function resetStaleProPromptHistory() {
    if (lastProInterviewerPromptAt && Date.now() - lastProInterviewerPromptAt > PRO_INTERVIEWER_PROMPT_GAP_MS) {
      clearProPromptHistory();
    }
  }

  function trace(event, data = {}) {
    debugTrace(event, data);
  }

  async function startProMemorySearch(payload = {}) {
    try {
      const result = await proAgent.searchMemoryCards(payload);
      return result || null;
    } catch (error) {
      logger.warn?.('Clyde Pro memory search failed:', describeAssistantError(error));
      return null;
    }
  }

  function sendMemoryUpdate(memoryCards = []) {
    if (!memoryCards.length) {
      return;
    }

    sendUpdate({
      title: 'Memory',
      text: '',
      cards: memoryCards,
      groupId: `memory-${Date.now()}-${Math.random().toString(16).slice(2)}`
    });
  }

  async function runMemoryEnrichedFinal(payload = {}) {
    if (typeof proAgent.run !== 'function') {
      return null;
    }

    return proAgent.run({
      ...payload,
      toolsEnabled: false,
      allowMemorySearch: false,
      reasoningEffort: 'low'
    });
  }

  async function waitForMemoryResult(memoryPromise, waitMs) {
    if (!memoryPromise || waitMs <= 0) {
      return null;
    }

    let timeoutId;
    return Promise.race([
      memoryPromise,
      new Promise((resolve) => {
        timeoutId = setTimeout(() => resolve(null), waitMs);
      })
    ]).finally(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    });
  }

  async function warmup() {
    if (!shouldUseProAgent(settings, {}) || typeof proAgent.warmup !== 'function') {
      return false;
    }

    return proAgent.warmup({
      mode: normalizeMode(currentContext.mode || settings.appMode || settings.mode || 'interview'),
      command: 'assist',
      context: currentContext
    });
  }

  function resetTranscript() {
    transcriptTurns = [];
    intentTurns = [];
    partialQuestionGate.clear();
    latestProRunTextByGroup.clear();
    displayedProRunTextByGroup.clear();
    recentDisplayedProRuns = [];
    lastAutomaticTargetQuestion = '';
    clearProPromptHistory();
    for (const timer of partialQuestionTimers.values()) {
      clearTimeout(timer);
    }
    partialQuestionTimers.clear();
    clearPendingIntentUtterance();
    rerunAfterInFlight = false;
    lastRunAt = 0;
    lastDigest = '';
    newlyAccumulatedTurns = 0;
    proAgent.close?.();
  }

  function appendAudioChunk(base64Audio) {
    if (shouldUseProAgent(settings, {}) && settings.proAgentRawAudioVAD === true && proAgent && typeof proAgent.appendAudioChunk === 'function') {
      proAgent.appendAudioChunk(base64Audio);
    }
  }

  return {
    addTranscript,
    addPartialTranscript,
    maybeRun,
    requestSuggestion,
    warmup,
    setContext,
    resetTranscript,
    appendAudioChunk,
    getTranscriptTurns: () => [...transcriptTurns]
  };

  function queueInterviewerIntentUtterance(speaker, text) {
    if (utteranceSettleMs <= 0) {
      appendIntentTurn(speaker, text);
      return true;
    }

    if (pendingIntentUtterance && pendingIntentUtterance.speaker !== speaker) {
      commitPendingIntentUtterance();
      scheduleSettledIntentRun();
      pendingIntentUtterance = createPendingIntentUtterance(speaker, text);
      restartIntentSettleTimer();
      return false;
    }

    if (
      pendingIntentUtterance
      && shouldStartNewIntentUtterance(pendingIntentUtterance.text, text)
    ) {
      commitPendingIntentUtterance();
      scheduleSettledIntentRun();
      pendingIntentUtterance = createPendingIntentUtterance(speaker, text);
      restartIntentSettleTimer();
      return false;
    }

    if (pendingIntentUtterance) {
      pendingIntentUtterance.text = mergeUtteranceText(pendingIntentUtterance.text, text);
    } else {
      pendingIntentUtterance = createPendingIntentUtterance(speaker, text);
    }

    restartIntentSettleTimer();
    return false;
  }

  function appendIntentTurn(speaker, text) {
    const clean = cleanText(text);

    if (!clean) {
      return false;
    }

    intentTurns.push({
      id: nextIntentTurnId,
      speaker,
      text: clean
    });
    nextIntentTurnId++;
    intentTurns = intentTurns.slice(-Math.max(24, maxTurns * 3));
    return true;
  }

  function createPendingIntentUtterance(speaker, text) {
    return {
      speaker,
      text: cleanText(text)
    };
  }

  function commitPendingIntentUtterance() {
    if (!pendingIntentUtterance) {
      return false;
    }

    const committed = appendIntentTurn(pendingIntentUtterance.speaker, pendingIntentUtterance.text);
    pendingIntentUtterance = null;
    return committed;
  }

  function clearPendingIntentUtterance() {
    if (intentSettleTimer) {
      clearTimeout(intentSettleTimer);
      intentSettleTimer = null;
    }

    pendingIntentUtterance = null;
  }

  function restartIntentSettleTimer() {
    if (intentSettleTimer) {
      clearTimeout(intentSettleTimer);
    }

    const settleDelay = getIntentSettleDelay(
      pendingIntentUtterance?.text || '',
      utteranceSettleMs,
      incompleteUtteranceSettleMs
    );

    intentSettleTimer = setTimeout(() => {
      intentSettleTimer = null;

      if (commitPendingIntentUtterance()) {
        maybeRun().catch((error) => {
          logger.error('Settled meeting assistant run failed:', describeAssistantError(error));
        });
      }
    }, settleDelay);
  }

  function scheduleSettledIntentRun() {
    setTimeout(() => {
      maybeRun().catch((error) => {
        logger.error('Settled meeting assistant run failed:', describeAssistantError(error));
      });
    }, 0);
  }
}

function getIntentSettleDelay(text, utteranceSettleMs, incompleteUtteranceSettleMs) {
  if (hasLikelyCompleteInterviewerPrompt(text)) {
    if (/[?.!]\s*$/.test(text)) {
      return utteranceSettleMs;
    }
    return Math.max(utteranceSettleMs, 1000);
  }

  return incompleteUtteranceSettleMs;
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

function getMaxIntentTurnId(turns = []) {
  return turns.reduce((maxId, turn) => Math.max(maxId, Number(turn.id) || 0), 0);
}

function isUserSpeaker(speaker) {
  return String(speaker || '').trim().toLowerCase() === 'you';
}

function resolveAssistantCommand({
  mode,
  isSayNextRequest,
  isScreenQuestionRequest,
  isCustomPromptRequest,
  isInterviewerQuestionsRequest,
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

  if (isInterviewerQuestionsRequest) {
    return 'interviewer_questions';
  }

  if (isScreenQuestionRequest) {
    return 'screen_question';
  }

  return isSayNextRequest ? 'suggestion' : (isManualQuestion ? 'manual_question' : (isSuggestionRequest ? 'suggestion' : 'assist'));
}

function transcriptDigest(transcript = []) {
  if (!Array.isArray(transcript)) {
    return '';
  }

  return transcript
    .map((turn) => {
      const speaker = cleanText(turn?.speaker || 'Unknown');
      const text = cleanText(turn?.text);
      return text ? `${speaker}: ${text}` : '';
    })
    .filter(Boolean)
    .join('\n');
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
    const textValue = cleanText(item.text || item.suggestion || item.body);
    const context = cleanText(item.referenced_transcript || item.context || item.question || '');
    const bullets = Array.isArray(item.bullets) ? item.bullets.map(cleanText).filter(Boolean) : [textValue].filter(Boolean);
    if (context || bullets.length) {
      cards.push({
        type: 'suggestion',
        title: 'Say next',
        question: context,
        bullets,
        body: textValue,
        id: Buffer.from(context || bullets.join(' ')).toString('base64')
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

  for (const item of toArray(parsed.memory_cards)) {
    const textValue = cleanText(item.fact || item.text || item.body);
    const source = cleanText(item.source || item.filename || item.session_title);

    if (textValue) {
      cards.push({
        type: 'memory',
        title: 'Memory',
        body: textValue,
        detail: source,
        agentic: true
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

  if (command === 'interviewer_questions') {
    return 'Schema: {"answers":[{"question":"Questions to ask the interviewer","bullets":["..."]}]}.';
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
  } else if (command === 'screen_question') {
    if (screenshot) {
      lines.push('A current desktop screenshot is attached. Analyze the attached screenshot of the user\'s desktop along with the recent transcript turns, and provide a single answer card summarizing your analysis and suggestions.');
    } else {
      lines.push('Analyze the desktop screen context along with the recent transcript turns, and provide a single answer card summarizing your analysis and suggestions.');
    }
  } else {
    if (command === 'interviewer_questions') {
      lines.push('Generate 3 concise questions the candidate can ask the interviewer now. Use the full transcript and active context. Prioritize questions that show preparation, clarify expectations, team needs, success measures, risks, and next steps. Return one answer card with the question field set to "Questions to ask the interviewer" and each suggested question as a bullet.');
    }

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

function shouldUseProAgent(settings = {}, request = {}) {
  return settings.userTier === 'pro'
    && settings.proAgentEnabled !== false
    && !request.screenshot
    && Boolean(settings.transcriptionApiKey || (settings.llmProvider === 'openai' ? settings.llmApiKey : '') || settings.openAiApiKey || process.env.OPENAI_API_KEY);
}

function shouldAllowProMemorySearch({
  now = Date.now(),
  isManualQuestion = false,
  isSuggestionRequest = false,
  lastProMemorySearchAt = 0,
  proMemorySearchIntervalMs = 15000
} = {}) {
  if (isManualQuestion || isSuggestionRequest) {
    return true;
  }

  return now - lastProMemorySearchAt >= proMemorySearchIntervalMs;
}

function isFreeAssistantConfigured({ provider, model, localUrl, apiKey }) {
  if (provider === 'local') {
    return Boolean(model && localUrl);
  }

  return Boolean(apiKey);
}

function shouldStartNewIntentUtterance(currentText, nextText) {
  const current = normalizeUtteranceText(currentText);
  const next = normalizeUtteranceText(nextText);

  return /[?.!]\s*$/.test(current) && /^(can|could|would|what|why|how|tell|walk|if|where|when|do|did|are|is|was|were)\b/i.test(next);
}

function isAutomaticInterviewAssist(mode, isSuggestionRequest = false, isManualQuestion = false) {
  return mode === 'interview' && !isSuggestionRequest && !isManualQuestion;
}

function hasLikelyCompleteInterviewerPrompt(text) {
  return classifyProGatePrompt(extractLatestInterviewerPrompt(text)).complete;
}

function hasInterviewPromptCue(text) {
  return /\b(can|could|would|what|why|how|when|where|who|which|tell me|walk me|talk me|describe|explain|share|give me|have you|do you|did you|are you|is there|was there|were there|describe a|tell me about)\b/i.test(text);
}

function isInterviewerSetupChatter(text) {
  const value = normalizeUtteranceText(text).toLowerCase();
  return /\bi have some questions\b/.test(value)
    || /\bquestions\b.*\btell me about a time\b.*\btype questions\b/.test(value)
    || /\bi'?m looking for\b.*\bspecific examples\b/.test(value)
    || /\bwhat exactly you did versus the team\b/.test(value)
    || /\bwhat the impact was\b.*\bthings like that\b/.test(value);
}

function isTinyUserFiller(text) {
  const value = normalizeUtteranceText(text).toLowerCase().replace(/[^\w\s']/g, '');
  if (!value) {
    return true;
  }

  const words = value.split(/\s+/).filter(Boolean);
  return words.length <= 3
    && /^(just|yeah|yep|yes|right|okay|ok|cool|sure|mm|mhm|uh huh|got it|thanks|thank you|one sec|one second)$/i.test(value);
}

function isShortFollowUpPrompt(text) {
  const value = normalizeUtteranceText(text);
  if (!value) {
    return false;
  }

  const words = value.split(/\s+/).filter(Boolean);
  return words.length <= 8
    && /^(and\s+)?(what happened|what was the outcome|what did you do|how did you handle it|how did it go|why was that hard|what made it hard|what was difficult|what came next)\??$/i.test(value);
}

function hasCompleteProGatePrompt(text) {
  return classifyProGatePrompt(text).complete;
}

function cleanProTargetQuestion(text) {
  return repairMalformedQuestionLead(stripLeadingQuestionFiller(cleanText(text)))
    .replace(/\bwe['’]?ll have downstream effects\b/gi, 'will have downstream effects')
    .replace(/\b(customer experience platform)\s+i'?m not an internal system\b/gi, '$1 and another internal system')
    .replace(/\b(customer experience platform)\s+another internal system\b/gi, '$1 and another internal system')
    .replace(/\b(other systems or teams)\s+me through your process\b/gi, '$1 Walk me through your process')
    .replace(/\bfunc\b/gi, 'function')
    .replace(/\bAline\b/g, 'align')
    .replace(/\s+/g, ' ')
    .trim();
}

function repairMalformedQuestionLead(text) {
  const value = normalizeUtteranceText(text);
  const malformedLead = /^(?:are|is|was|were)\s+((?:the|a|an)\s+.+?\b(?:when|where|while|after|before|once)\b.+?)\s+(?:and\s+)?((?:what|how|why|when|where|who|which|do|does|did|can|could|would|is|are|was|were|have|has)\b.+)$/i;
  const match = value.match(malformedLead);
  if (!match) {
    return value;
  }

  const lead = match[1].trim();
  const followUp = match[2].trim().replace(/^[A-Z]/, (letter) => letter.toLowerCase());
  return `What was ${lead} and ${followUp}`;
}

function stripLeadingQuestionFiller(text) {
  let value = normalizeUtteranceText(text);
  let changed = true;
  while (changed) {
    const next = value
      .replace(/^(?:um|uh|okay|ok|right|cool|hey|so|let'?s see|let me just look at this real quick)[,.\s]+/i, '')
      .replace(/^(and then\s+)?(?:um|uh|okay|ok|right|cool|hey|so|let'?s see)[,.\s]+/i, '$1');
    changed = next !== value;
    value = next;
  }
  return value.trim();
}

function isStaleProRun(latest, targetQuestion) {
  const current = normalizeUtteranceText(targetQuestion);
  if (!latest || !current || latest === current) {
    return false;
  }

  const latestWords = latest.split(/\s+/).filter(Boolean);
  const currentWords = current.split(/\s+/).filter(Boolean);
  return latestWords.length >= currentWords.length + 4
    && (latest.toLowerCase().startsWith(current.toLowerCase()) || textSimilarity(latest, current) >= 0.72);
}

function shouldReplaceLatestProRunText(latest, next) {
  const current = normalizeUtteranceText(next);
  if (!latest || !current) {
    return Boolean(current);
  }

  const latestWords = latest.split(/\s+/).filter(Boolean);
  const currentWords = current.split(/\s+/).filter(Boolean);
  return currentWords.length >= latestWords.length
    || current.toLowerCase().startsWith(latest.toLowerCase());
}

function shouldReplaceQueuedForcedRun(previousOptions = {}, nextOptions = {}) {
  const previousQuestion = normalizeUtteranceText(previousOptions.targetQuestion);
  const nextQuestion = normalizeUtteranceText(nextOptions.targetQuestion);
  if (!previousQuestion || !nextQuestion) {
    return Boolean(nextQuestion);
  }

  const previousWords = previousQuestion.split(/\s+/).filter(Boolean);
  const nextWords = nextQuestion.split(/\s+/).filter(Boolean);
  return nextWords.length >= previousWords.length
    || nextQuestion.toLowerCase().startsWith(previousQuestion.toLowerCase());
}

function isSameOrNearDuplicateQuestion(left, right) {
  const normalizedLeft = normalizeUtteranceText(left);
  const normalizedRight = normalizeUtteranceText(right);
  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  const leftLower = normalizedLeft.toLowerCase();
  const rightLower = normalizedRight.toLowerCase();
  if (leftLower === rightLower) {
    return true;
  }

  const leftWords = leftLower.split(/\s+/).filter(Boolean);
  const rightWords = rightLower.split(/\s+/).filter(Boolean);
  const wordDelta = Math.abs(leftWords.length - rightWords.length);
  const shorter = leftLower.length <= rightLower.length ? leftLower : rightLower;
  const longer = leftLower.length > rightLower.length ? leftLower : rightLower;

  return (wordDelta <= 3 && longer.startsWith(`${shorter} `))
    || textSimilarity(normalizedLeft, normalizedRight) >= 0.9;
}

function isDuplicateRecentDisplayedQuestion(displayedQuestion, targetQuestion) {
  const displayed = normalizeUtteranceText(displayedQuestion);
  const target = normalizeUtteranceText(targetQuestion);
  if (!displayed || !target) {
    return false;
  }

  if (isSameOrNearDuplicateQuestion(displayed, target)) {
    return true;
  }

  const displayedWords = displayed.split(/\s+/).filter(Boolean);
  const targetWords = target.split(/\s+/).filter(Boolean);
  const wordDelta = Math.abs(displayedWords.length - targetWords.length);
  const displayedLower = displayed.toLowerCase();
  const targetLower = target.toLowerCase();
  const shorter = displayedLower.length <= targetLower.length ? displayedLower : targetLower;
  const longer = displayedLower.length > targetLower.length ? displayedLower : targetLower;
  const isSmallContinuation = wordDelta <= 8 && longer.startsWith(`${shorter} `);

  return isSmallContinuation || textSimilarity(displayed, target) >= 0.68;
}

function classifyProGatePrompt(text) {
  const latestPrompt = extractLatestInterviewerPrompt(text);
  const prompt = stripTrailingAcknowledgement(stripLeadingQuestionFiller(normalizeUtteranceText(latestPrompt)));

  if (!prompt) {
    return { complete: false, hasStrongTerminal: false, reason: 'empty' };
  }

  if (isInterviewerSetupChatter(prompt)) {
    return { complete: false, hasStrongTerminal: false, reason: 'setup-chatter' };
  }

  if (!hasInterviewPromptCue(prompt)) {
    return { complete: false, hasStrongTerminal: false, reason: 'no-prompt-cue' };
  }

  const hasStrongTerminal = /[?.!]\s*$/.test(prompt) || prompt.includes('?');
  const words = prompt.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  if (hasLikelyTerminalCommandPhrase(prompt) && wordCount >= 7) {
    return { complete: true, hasStrongTerminal, reason: 'terminal-command-phrase' };
  }

  if (isDanglingPromptFragment(prompt)) {
    return { complete: false, hasStrongTerminal, reason: 'dangling-fragment' };
  }

  if (hasStrongTerminal) {
    return { complete: true, hasStrongTerminal, reason: 'terminal-punctuation' };
  }

  const startsWithQuestionWord = /^(?:and\s+then\s+)?(can|could|would|what|why|how|when|where|who|which|do|did|are|is|was|were|have|has|had|will|should)\b/i.test(prompt);
  const hasCommandRequest = /\b(tell me|walk me|talk me|describe|explain|share|give me|show me)\b/i.test(prompt);
  const hasFollowUpRequest = /\b(another example|go(?:ing)? deeper|more detail|what happened|what was the outcome|what came next)\b/i.test(prompt);

  if ((startsWithQuestionWord || hasCommandRequest || hasFollowUpRequest) && wordCount >= 10) {
    return { complete: true, hasStrongTerminal, reason: 'stable-question-shape' };
  }

  return { complete: false, hasStrongTerminal, reason: 'too-short-or-unclear' };
}

function hasLikelyTerminalCommandPhrase(text) {
  return /\bwalk me through (?:your|the|that|this)?\s*process\s*$/i.test(text)
    || /\bwhat happened\s*$/i.test(text)
    || /\bwhat was the outcome\s*$/i.test(text)
    || /\bwhat came next\s*$/i.test(text)
    || /\bunder pressure to meet tight deadlines\s*$/i.test(text)
    || /\bgo(?:ing)? deeper into that(?: one)?\s*$/i.test(text);
}

function isDanglingPromptFragment(text) {
  const value = normalizeUtteranceText(text);
  if (!value) {
    return true;
  }

  if (/[?.!]\s*$/.test(value)) {
    return false;
  }

  if (hasOpenPurposeClause(value)) {
    return true;
  }

  if (hasOpenVerbFragment(value)) {
    return true;
  }

  if (/\ba time\s*$/i.test(value)
    || /\byou (?:audited|designed|maintained|managed|handled|built|created|led|owned|improved)\s*$/i.test(value)
    || /\byou had(?:\s+to)?\s*$/i.test(value)
    || /\byou had to \w+\s*$/i.test(value)
    || /\bacross\s+\w+\s*$/i.test(value)
    || (/\bunder pressure to meet(?:\s+\w+){0,2}\s*$/i.test(value) && !/\bunder pressure to meet tight deadlines\s*$/i.test(value))
    || /\bhigh ticket count(?:\s+but\s+you\s+notice(?:\s+\w+){0,3})?\s*$/i.test(value)
    || /\bhow do you typically go about managing that or turning\s*$/i.test(value)
    || /\bcritical tasks(?:\s+maintain)?\s*$/i.test(value)
    || /\bmaintain(?:\s+high)?\s*$/i.test(value)
    || /\bsupport func(?:tion)?(?:\s+i benchmark(?:\s+\w+){0,4})?\s*$/i.test(value)
    || /\bas\s+(?:an?|the)\s+\w+\s*$/i.test(value)
    || /\blike\s+[A-Z][\w-]*\s*$/.test(value)
    || /\b(?:api[-\s]?based\s+)?integration\s*$/i.test(value)
    || /\bif\s+you\s+do\s+have(?:\s+\w+){0,2}\s*$/i.test(value)
    || /\bbetween\b(?!.*\b(?:and|another|other|internal|external)\b)/i.test(value)
    || /^how\s+do\s+you\s+evaluate\s+whether\b(?!.*\bwalk\s+me\s+through\b)/i.test(value)) {
    return true;
  }

  return /\b(and|or|but|if|than|because|unless|although|between|with|from|to|for|in|of|on|at|by|about|through|into|using|via|across|under|over|around|before|after|while|where|when|whether|the|a|an|difference|different|versus|vs)\s*$/i.test(value)
    || /\b(who|what|when|where|why|how|which|that|they|you|we|it)\s*$/i.test(value)
    || /\b(a|an|the|this|that|those|these|your|their|our|its)\s*$/i.test(value);
}

function hasOpenPurposeClause(text) {
  const value = normalizeUtteranceText(text);
  const lower = value.toLowerCase();
  const purposeMatch = lower.match(/\bto\s+([a-z]+)(?:\s+[a-z0-9'-]+){1,6}$/);
  if (!purposeMatch) {
    return false;
  }

  if (/\b(when|while|where|if|unless|until|because|so that|in case|under|during)\b/.test(lower.slice(purposeMatch.index))) {
    return false;
  }

  return /^(how\s+(?:would|do|did|will|can|could|should)\s+you|what\s+would\s+you\s+do)\b/.test(lower);
}

function hasOpenVerbFragment(text) {
  const value = normalizeUtteranceText(text).toLowerCase();
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length < 5) {
    return false;
  }

  const last = words[words.length - 1];
  const previous = words[words.length - 2];
  const bareVerbs = new Set([
    'add', 'address', 'adjust', 'align', 'answer', 'balance', 'build', 'change', 'coach', 'communicate',
    'create', 'define', 'deliver', 'drive', 'evaluate', 'fix', 'handle', 'improve', 'keep', 'lead',
    'maintain', 'make', 'manage', 'measure', 'prioritize', 'reduce', 'resolve', 'scale', 'set',
    'structure', 'support', 'turn', 'use'
  ]);
  const openConnectors = new Set(['and', 'or', 'to', 'then', 'also']);

  return bareVerbs.has(last) && openConnectors.has(previous);
}

function shouldMergeIntoPriorProPrompt(previous, current) {
  const left = stripTrailingAcknowledgement(normalizeUtteranceText(previous));
  const right = normalizeUtteranceText(current);

  if (!left || !right) {
    return false;
  }

  if (isShortFollowUpPrompt(right)) {
    return true;
  }

  if (/[?.!]\s*$/.test(left)) {
    return false;
  }

  if (hasInterviewPromptCue(left) && !hasLikelyCompleteInterviewerPrompt(left)) {
    return true;
  }

  return !/^(can|could|would|what|why|how|when|where|who|which|do|did|are|is|was|were|tell|walk|describe|explain|share|give)\b/i.test(right);
}

function reconcileDraftAndFinalCards(draftCards = [], finalCards = []) {
  const draft = Array.isArray(draftCards) ? draftCards.find((card) => card?.type === 'answer') : null;
  const final = Array.isArray(finalCards) ? finalCards.find((card) => card?.type === 'answer') : null;

  if (!draft || !final) {
    return finalCards;
  }

  const draftBullets = Array.isArray(draft.bullets) ? draft.bullets.map(cleanText).filter(Boolean).slice(0, 3) : [];
  const finalBullets = Array.isArray(final.bullets) ? final.bullets.map(cleanText).filter(Boolean) : [];
  if (draftBullets.length !== 3 || !finalBullets.length) {
    return finalCards;
  }

  const finalQuestion = cleanText(final.question);
  const draftQuestion = cleanText(draft.question);
  const finalQuestionWords = finalQuestion.split(/\s+/).filter(Boolean);
  const questionChanged = finalQuestion
    && draftQuestion
    && finalQuestionWords.length >= 5
    && hasInterviewPromptCue(finalQuestion)
    && !isSameOrNearDuplicateQuestion(finalQuestion, draftQuestion)
    && textSimilarity(finalQuestion, draftQuestion) < 0.6;
  const additionalBullets = collectSupplementalFinalBullets(draftBullets, finalBullets);

  if (!additionalBullets.length && !questionChanged) {
    return [];
  }

  const detailBullets = [
    ...(Array.isArray(draft.detailBullets) ? draft.detailBullets.map(cleanText).filter(Boolean) : []),
    ...additionalBullets.map((bullet) => boilDownDetailBullet(bullet, draftBullets))
  ].filter(Boolean);

  const { draft: _draftFlag, ...draftCard } = draft;
  return [{
    ...draftCard,
    title: 'Say next',
    question: questionChanged ? finalQuestion : draft.question,
    bullets: draftBullets,
    detail: cleanText(draft.detail),
    detailBullets
  }];
}

function collectSupplementalFinalBullets(draftBullets = [], finalBullets = []) {
  const additions = [];
  for (const finalBullet of finalBullets.map(cleanText).filter(Boolean)) {
    if (finalBullet.split(/\s+/).filter(Boolean).length < 5) {
      continue;
    }

    const bestDraft = draftBullets
      .map((draftBullet) => ({
        bullet: draftBullet,
        similarity: textSimilarity(draftBullet, finalBullet)
      }))
      .sort((left, right) => right.similarity - left.similarity)[0];

    const supplement = bestDraft ? extractSupplementalClause(bestDraft.bullet, finalBullet) : '';
    if (supplement) {
      additions.push(supplement);
      continue;
    }

    if (!bestDraft || bestDraft.similarity < 0.5) {
      additions.push(finalBullet);
      continue;
    }
  }

  return dedupeDetailBullets(additions, draftBullets);
}

function extractSupplementalClause(draftBullet, finalBullet) {
  const draftTokens = tokenSet(draftBullet);
  const finalText = cleanText(finalBullet);
  const draftText = cleanText(draftBullet);
  if (draftText && finalText.toLowerCase().startsWith(draftText.toLowerCase())) {
    const remainder = cleanText(finalText.slice(draftText.length).replace(/^[,.;:\s-]+/, ''));
    if (remainder.split(/\s+/).filter(Boolean).length >= 5) {
      return remainder;
    }
  }

  const clauses = finalText
    .split(/(?:;|,|\s+-\s+|\s+\band\b\s+|\s+\bwhich\b\s+|\s+\bso\b\s+)/i)
    .map(cleanText)
    .filter((clause) => clause.split(/\s+/).filter(Boolean).length >= 5);

  for (const clause of clauses) {
    const clauseTokens = tokenSet(clause);
    const newTokens = [...clauseTokens].filter((token) => !draftTokens.has(token));
    if (newTokens.length >= 3 && textSimilarity(clause, draftBullet) < 0.65) {
      return clause;
    }
  }

  return '';
}

function dedupeDetailBullets(additions = [], draftBullets = []) {
  const kept = [];
  for (const addition of additions.map(cleanText).filter(isUsefulDetailBullet)) {
    if (draftBullets.some((draftBullet) => textSimilarity(draftBullet, addition) >= 0.55)) {
      continue;
    }
    if (kept.some((existing) => textSimilarity(existing, addition) >= 0.72)) {
      continue;
    }
    kept.push(addition);
  }
  return kept.slice(0, 3);
}

function isUsefulDetailBullet(value) {
  const text = cleanText(value);
  if (!text) {
    return false;
  }

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 4) {
    return false;
  }

  const lower = text.toLowerCase().replace(/[.,;:!?]+$/g, '');
  if (/^(and|or|but|so|then|which|that|for|to|from|into|where|when)\b/i.test(lower)) {
    return false;
  }

  if (/\b(and|or|but|so|then|which|that|with|by|for|to|from|into|where|when|using|through|during|across|between|including|such as|like)$/i.test(lower)) {
    return false;
  }

  const hasConcreteAnchor = /\b(api|apis|jira|freshdesk|zendesk|intercom|fin|zapier|github|power bi|dashboard|ticket|tickets|workflow|workflows|routing|handoff|handoffs|engineering|support|agent|agents|customer|customers|queue|queues|escalation|escalations|integration|integrations|automation|automations|runbook|runbooks|sandbox|rollout|pilot|metric|metrics|kpi|kpis|resolution|response|handle time|sync|form|forms|validation|monitoring|failures?|errors?|volume|headcount|dependency|dependencies|stakeholders?|roadmap|product|operations?)\b/i.test(lower);
  const hasNumber = /\d/.test(lower);
  const hasAction = /\b(built|created|linked|routed|reduced|improved|increased|measured|monitored|visualized|surfaced|mapped|validated|tested|piloted|implemented|designed|managed|tracked|caught|resolved|troubleshot|automated|connected|visible)\b/i.test(lower);

  return hasNumber || (hasConcreteAnchor && hasAction);
}

function boilDownDetailBullet(value, existingBullets = []) {
  let text = cleanText(value)
    .replace(/^(also|additionally|additional context|context)\s*[:,-]?\s*/i, '')
    .replace(/\s+/g, ' ');
  for (const existing of existingBullets) {
    const existingText = cleanText(existing);
    if (existingText && text.toLowerCase().startsWith(existingText.toLowerCase())) {
      text = cleanText(text.slice(existingText.length));
    }
  }
  return isUsefulDetailBullet(text) ? text : '';
}

function textSimilarity(left, right) {
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);
  if (!leftTokens.size || !rightTokens.size) {
    return 0;
  }

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function tokenSet(value) {
  const stopWords = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'by', 'for', 'i', 'in', 'it', 'of', 'on', 'or', 'so', 'the', 'to', 'with']);
  return new Set(
    normalizeUtteranceText(value)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token && !stopWords.has(token))
  );
}

function extractLatestInterviewerPrompt(text) {
  const value = String(text || '').trim();

  if (!value) {
    return '';
  }

  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const last = parseSpeakerLine(lines[lines.length - 1] || value);

  if (!last.speaker) {
    return normalizeUtteranceText(last.text);
  }

  const parts = [last.text];
  for (let index = lines.length - 2; index >= 0; index -= 1) {
    const row = parseSpeakerLine(lines[index]);
    // Merge consecutive turns if both are interviewer turns (neither is the user)
    const isLastUser = isUserSpeaker(last.speaker);
    const isRowUser = isUserSpeaker(row.speaker);
    if (isLastUser !== isRowUser) {
      break;
    }
    parts.unshift(row.text);
  }

  return parts.reduce((merged, part) => mergeUtteranceText(merged, part), '');
}

function parseSpeakerLine(line = '') {
  const value = String(line || '').trim();
  const separatorIndex = value.indexOf(':');
  if (separatorIndex === -1) {
    return { speaker: '', text: value };
  }

  return {
    speaker: value.slice(0, separatorIndex).trim(),
    text: value.slice(separatorIndex + 1).trim()
  };
}

function mergeUtteranceText(left, right) {
  const cleanLeft = stripTrailingAcknowledgement(normalizeUtteranceText(left));
  const cleanRight = normalizeUtteranceText(right);

  if (!cleanLeft) {
    return cleanRight;
  }

  if (!cleanRight) {
    return cleanLeft;
  }

  const lowerLeft = cleanLeft.toLowerCase();
  const lowerRight = cleanRight.toLowerCase();

  if (lowerRight === lowerLeft || lowerRight.startsWith(`${lowerLeft} `)) {
    return cleanRight;
  }

  const leftWords = cleanLeft.split(' ');
  const rightWords = cleanRight.split(' ');
  const maxOverlap = Math.min(8, leftWords.length, rightWords.length);

  for (let size = maxOverlap; size > 0; size -= 1) {
    const leftTail = leftWords.slice(-size).join(' ').toLowerCase();
    const rightHead = rightWords.slice(0, size).join(' ').toLowerCase();

    if (leftTail === rightHead) {
      return [...leftWords, ...rightWords.slice(size)].join(' ');
    }
  }

  return `${cleanLeft} ${cleanRight}`;
}

function normalizeUtteranceText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function stripTrailingAcknowledgement(value) {
  return normalizeUtteranceText(value)
    .replace(/([?.!])\s+(yeah|yep|right|cool|okay|ok)\.?$/i, '$1')
    .replace(/\s+(yeah|yep)\.?$/i, '');
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
  parseAssistantCards,
  shouldAllowProMemorySearch,
  shouldUseProAgent
};
