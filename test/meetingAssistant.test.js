const assert = require('node:assert/strict');
const test = require('node:test');

const { extractLikelyInterviewQuestion: realExtractLikelyInterviewQuestion } = require('../src/pineconeClient');

const {
  createMeetingAssistant,
  describeAssistantError,
  extractAssistantText,
  isUserSpeaker,
  normalizeSelectedSources,
  parseAssistantCards
} = require('../src/meetingAssistant');

async function waitFor(predicate, timeoutMs = 500) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  assert.fail('Timed out waiting for condition.');
}

test('skips LM Studio calls until configured', async () => {
  const assistant = createMeetingAssistant({
    settings: { llmProvider: 'local', llmModel: '' }
  });

  const firstTurn = await assistant.addTranscript({ speaker: 'Test', text: 'Hello' });
  const secondTurn = await assistant.maybeRun(true, true);

  assert.strictEqual(firstTurn.skipped, 'not-configured');
  assert.strictEqual(secondTurn.skipped, 'not-configured');
});

test('merges consecutive transcript turns from the same speaker', async () => {
  const assistant = createMeetingAssistant();
  await assistant.addTranscript({ speaker: 'System Audio', text: 'What is' });
  await assistant.addTranscript({ speaker: 'System Audio', text: 'Aladdin?' });
  
  const turns = assistant.getTranscriptTurns();
  assert.equal(turns.length, 1);
  assert.equal(turns[0].text, 'What is Aladdin?');
});

test('posts rolling transcript to LM Studio chat completions', async () => {
  const updates = [];
  const requests = [];

  const assistant = createMeetingAssistant({
    settings: {
        llmProvider: 'local',
        localLlmUrl: 'http://localhost:1234/v1/chat/completions',
        llmModel: 'gemma-4-e4b'
    },
    axiosClient: {
      post: async (url, data) => {
        requests.push({ url, data });

        return {
          data: {
            choices: [{
              message: { content: '{"answers": [{"question":"Why?", "bullets": ["A"]}]}' }
            }]
          }
        };
      }
    },
    intervalMs: 1,
    sendUpdate: (update) => updates.push(update)
  });

  await assistant.addTranscript({ speaker: 'System Audio', text: 'Can you give an example of a process you have put in place to help scale the team better?' });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'http://localhost:1234/v1/chat/completions');
  assert.equal(requests[0].data.model, 'gemma-4-e4b');
  assert.equal(requests[0].data.max_tokens, 1500);
  assert.deepEqual(requests[0].data.response_format.json_schema.schema.properties, {
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
  });
  assert.match(requests[0].data.messages[0].content, /The user wearing Clyde \("You"\) is the job candidate/);
  assert.match(requests[0].data.messages[0].content, /The "System Audio" and any other speakers are the interviewers/);
  assert.match(requests[0].data.messages[1].content, /System Audio: Can you give an example of a process you have put in place to help scale the team better/);
  assert.equal(updates[0].cards[0].type, 'answer');
  assert.equal(updates[0].cards[0].question, 'Why?');
  assert.deepEqual(updates[0].cards[0].bullets, ['A']);
});

test('normalizes LM Studio base URL before posting chat completions', async () => {
  const requests = [];

  const assistant = createMeetingAssistant({
    settings: {
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234',
      llmModel: 'gemma-4-e4b'
    },
    axiosClient: {
      post: async (url, data) => {
        requests.push({ url, data });
        return {
          data: {
            choices: [{
              message: { content: '{"answers": [{"question":"Why?", "bullets": ["A"]}]}' }
            }]
          }
        };
      }
    },
    intervalMs: 1
  });

  await assistant.addTranscript({
    speaker: 'System Audio',
    text: 'Can you walk me through a time when you improved frontline agent efficiency?'
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'http://localhost:1234/v1/chat/completions');
});

test('local automatic assist waits for complete fragments and answers the latest question', async () => {
  const requests = [];
  const updates = [];

  const assistant = createMeetingAssistant({
    settings: {
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'gemma-4-e4b'
    },
    axiosClient: {
      post: async (url, data) => {
        requests.push({ url, data });
        return {
          data: {
            choices: [{
              message: { content: '{"answers": [{"question":"How would you manage critical tasks under pressure?", "bullets": ["Prioritize by impact.", "Protect service quality.", "Communicate tradeoffs."]}]}' }
            }]
          }
        };
      }
    },
    intervalMs: 12000,
    sendUpdate: (update) => updates.push(update)
  });

  const first = await assistant.addTranscript({
    speaker: 'System Audio',
    text: 'How would you manage your critical tasks and maintain high'
  });
  assert.equal(first.skipped, 'waiting-for-complete-question');
  assert.equal(requests.length, 0);

  await assistant.addTranscript({
    speaker: 'System Audio',
    text: "quality service when you're working under pressure to meet tight deadlines?"
  });

  assert.equal(requests.length, 1);
  assert.match(requests[0].data.messages[1].content, /How would you manage your critical tasks and maintain high[\s\S]+quality service/);
  assert.equal(updates.length, 1);
});

test('local automatic assist bypasses rate limit for a distinct complete question', async () => {
  const requests = [];

  const assistant = createMeetingAssistant({
    settings: {
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'gemma-4-e4b'
    },
    axiosClient: {
      post: async (url, data) => {
        requests.push({ url, data });
        return {
          data: {
            choices: [{
              message: { content: '{"answers": [{"question":"Q", "bullets": ["A"]}]}' }
            }]
          }
        };
      }
    },
    intervalMs: 12000
  });

  await assistant.addTranscript({
    speaker: 'System Audio',
    text: 'How do you handle self-service and documentation?'
  });
  await assistant.addTranscript({
    speaker: 'System Audio',
    text: 'Have you explored using AI agents like Fin to deflect common queries?'
  });

  assert.equal(requests.length, 2);
  assert.match(requests[0].data.messages[1].content, /How do you handle self-service and documentation/);
  assert.match(requests[1].data.messages[1].content, /Have you explored using AI agents like Fin/);
});

test('interviewer questions request uses the supplied full transcript', async () => {
  const requests = [];
  const assistant = createMeetingAssistant({
    settings: {
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'gemma-4-e4b'
    },
    axiosClient: {
      post: async (url, data) => {
        requests.push({ url, data });
        return {
          data: {
            choices: [{
              message: { content: '{"answers": [{"question":"Questions to ask the interviewer", "bullets": ["How is success measured?"]}]}' }
            }]
          }
        };
      }
    },
    sendUpdate: () => {}
  });

  const transcript = Array.from({ length: 12 }, (_, index) => ({
    speaker: index % 2 === 0 ? 'System Audio' : 'You',
    text: `Transcript turn ${index + 1}`
  }));

  await assistant.requestSuggestion({
    intent: 'interviewer_questions',
    mode: 'interview',
    prompt: 'Generate strong questions I can ask the interviewer now.',
    transcript
  });

  assert.equal(requests.length, 1);
  assert.match(requests[0].data.messages[0].content, /Current command: interviewer_questions/);
  assert.match(requests[0].data.messages[1].content, /Transcript turn 1/);
  assert.match(requests[0].data.messages[1].content, /Transcript turn 12/);
  assert.match(requests[0].data.messages[1].content, /Questions to ask the interviewer/);
});

test('answers fragmented consecutive interviewer questions separately', async () => {
  const originalGeminiApiKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const requests = [];

  try {
    const assistant = createMeetingAssistant({
      settings: {
        llmProvider: 'local',
        localLlmUrl: 'http://localhost:1234/v1/chat/completions',
        llmModel: 'gemma-4-e4b'
      },
      axiosClient: {
        post: async (url, data) => {
          requests.push({ url, data });
          return {
            data: {
              choices: [{
                message: { content: '{"answers": [{"question":"Answer", "bullets": ["A"]}]}' }
              }]
            }
          };
        }
      },
      intervalMs: 0
    });

    await assistant.addTranscript({ speaker: 'System Audio', text: 'If' });
    await assistant.addTranscript({ speaker: 'System Audio', text: 'If you were to get the job, what would your 30' });
    await assistant.addTranscript({ speaker: 'System Audio', text: 'sixty ninety day plan look like?' });
    await assistant.addTranscript({ speaker: 'System Audio', text: 'Why do you think you would be a good fit for this particular' });
    await assistant.addTranscript({ speaker: 'System Audio', text: 'particular role.' });
    await assistant.addTranscript({ speaker: 'System Audio', text: 'Can you tell me about the My Career Max project?' });

    const targetPrompts = requests.map((request) => request.data.messages[0].content);

    assert.equal(requests.length, 3);
    assert.match(targetPrompts[0], /The interviewer just asked this question: "If you were to get the job, what would your 30 sixty ninety day plan look like\?"/);
    assert.match(targetPrompts[1], /The interviewer just asked this question: "Why do you think you would be a good fit for this particular role\."/);
    assert.match(targetPrompts[2], /The interviewer just asked this question: "Can you tell me about the My Career Max project\?"/);
    assert.doesNotMatch(targetPrompts[2], /30 sixty ninety day plan.*good fit/s);
  } finally {
    if (originalGeminiApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalGeminiApiKey;
    }
  }
});

test('automatic assist answers live tuning customer operations prompts', async () => {
  const originalGeminiApiKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const requests = [];

  try {
    const assistant = createMeetingAssistant({
      settings: {
        llmProvider: 'local',
        localLlmUrl: 'http://localhost:1234/v1/chat/completions',
        llmModel: 'gemma-4-e4b'
      },
      axiosClient: {
        post: async (url, data) => {
          requests.push({ url, data });
          return {
            data: {
              choices: [{
                message: { content: '{"answers": [{"question":"Answer", "bullets": ["A"]}]}' }
              }]
            }
          };
        }
      },
      intervalMs: 0
    });

    await assistant.addTranscript({
      speaker: 'System Audio',
      text: 'How do you evaluate whether a change of tool or workflow will have downstream effects on other systems or teams. Walk me through your process.'
    });

    assert.equal(requests.length, 1);
    assert.match(
      requests[0].data.messages[0].content,
      /The interviewer just asked this question: "How do you evaluate whether a change of tool or workflow will have downstream effects on other systems or teams\. Walk me through your process\."/
    );
  } finally {
    if (originalGeminiApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalGeminiApiKey;
    }
  }
});

test('reruns intent detection when a final question fragment arrives during an in-flight check', async () => {
  const meetingAssistantPath = require.resolve('../src/meetingAssistant');
  const pineconeClientPath = require.resolve('../src/pineconeClient');
  const originalMeetingAssistantCache = require.cache[meetingAssistantPath];
  const originalPineconeClientCache = require.cache[pineconeClientPath];

  let resolveFirstIntent;
  let firstIntentStarted;
  const firstIntentStartedPromise = new Promise((resolve) => {
    firstIntentStarted = resolve;
  });

  try {
    delete require.cache[meetingAssistantPath];
    require.cache[pineconeClientPath] = {
      id: pineconeClientPath,
      filename: pineconeClientPath,
      loaded: true,
      exports: {
        detectResumeQuestion: async (transcript) => {
          if (!resolveFirstIntent) {
            firstIntentStarted();
            await new Promise((resolve) => {
              resolveFirstIntent = resolve;
            });
            return null;
          }

          return transcript.includes('sixty ninety day plan look like?')
            ? 'If you were to get the job, what would your 30 sixty ninety day plan look like?'
            : null;
        },
        searchResumeVectors: async () => [],
        extractLikelyInterviewQuestion: realExtractLikelyInterviewQuestion
      }
    };

    const { createMeetingAssistant: createAssistantWithFakeIntent } = require('../src/meetingAssistant');
    const requests = [];
    const assistant = createAssistantWithFakeIntent({
      settings: {
        llmProvider: 'local',
        localLlmUrl: 'http://localhost:1234/v1/chat/completions',
        llmModel: 'gemma-4-e4b'
      },
      axiosClient: {
        post: async (url, data) => {
          requests.push({ url, data });
          return {
            data: {
              choices: [{
                message: { content: '{"answers": [{"question":"Answer", "bullets": ["A"]}]}' }
              }]
            }
          };
        }
      },
      intervalMs: 0
    });

    const firstRun = assistant.addTranscript({
      speaker: 'System Audio',
      text: 'Can you tell me about your support career?'
    });

    await firstIntentStartedPromise;

    const finalFragment = await assistant.addTranscript({
      speaker: 'System Audio',
      text: 'If you were to get the job, what would your 30 sixty ninety day plan look like?'
    });

    assert.equal(finalFragment.skipped, 'in-flight');

    resolveFirstIntent();
    await firstRun;
    await waitFor(() => requests.length === 1);

    assert.match(
      requests[0].data.messages[0].content,
      /The interviewer just asked this question: "If you were to get the job, what would your 30 sixty ninety day plan look like\?"/
    );
  } finally {
    delete require.cache[meetingAssistantPath];

    if (originalMeetingAssistantCache) {
      require.cache[meetingAssistantPath] = originalMeetingAssistantCache;
    }

    if (originalPineconeClientCache) {
      require.cache[pineconeClientPath] = originalPineconeClientCache;
    } else {
      delete require.cache[pineconeClientPath];
    }
  }
});

test('runs intent detection only after interviewer utterance settles', async () => {
  const meetingAssistantPath = require.resolve('../src/meetingAssistant');
  const pineconeClientPath = require.resolve('../src/pineconeClient');
  const originalMeetingAssistantCache = require.cache[meetingAssistantPath];
  const originalPineconeClientCache = require.cache[pineconeClientPath];

  const detectedTranscripts = [];

  try {
    delete require.cache[meetingAssistantPath];
    require.cache[pineconeClientPath] = {
      id: pineconeClientPath,
      filename: pineconeClientPath,
      loaded: true,
      exports: {
        detectResumeQuestion: async (transcript) => {
          detectedTranscripts.push(transcript);
          return transcript.includes('particular role.')
            ? 'Why do you think you would be a good fit for this particular role.'
            : null;
        },
        searchResumeVectors: async () => [],
        extractLikelyInterviewQuestion: realExtractLikelyInterviewQuestion
      }
    };

    const { createMeetingAssistant: createAssistantWithFakeIntent } = require('../src/meetingAssistant');
    const requests = [];
    const assistant = createAssistantWithFakeIntent({
      settings: {
        llmProvider: 'local',
        localLlmUrl: 'http://localhost:1234/v1/chat/completions',
        llmModel: 'gemma-4-e4b'
      },
      axiosClient: {
        post: async (url, data) => {
          requests.push({ url, data });
          return {
            data: {
              choices: [{
                message: { content: '{"answers": [{"question":"Answer", "bullets": ["A"]}]}' }
              }]
            }
          };
        }
      },
      intervalMs: 0,
      utteranceSettleMs: 25
    });

    const firstFragment = await assistant.addTranscript({
      speaker: 'System Audio',
      text: 'Why do you think you would be a good fit for this particular'
    });
    const finalFragment = await assistant.addTranscript({
      speaker: 'System Audio',
      text: 'particular role.'
    });

    assert.equal(firstFragment.skipped, 'waiting-for-utterance');
    assert.equal(finalFragment.skipped, 'waiting-for-utterance');
    assert.equal(detectedTranscripts.length, 0);
    assert.equal(requests.length, 0);

    await waitFor(() => requests.length === 1, 1000);

    assert.equal(detectedTranscripts.length, 1);
    assert.match(
      detectedTranscripts[0],
      /System Audio: Why do you think you would be a good fit for this particular role\./
    );
    assert.match(
      requests[0].data.messages[0].content,
      /The interviewer just asked this question: "Why do you think you would be a good fit for this particular role\."/
    );
  } finally {
    delete require.cache[meetingAssistantPath];

    if (originalMeetingAssistantCache) {
      require.cache[meetingAssistantPath] = originalMeetingAssistantCache;
    }

    if (originalPineconeClientCache) {
      require.cache[pineconeClientPath] = originalPineconeClientCache;
    } else {
      delete require.cache[pineconeClientPath];
    }
  }
});

test('pro automatic assist waits for a complete interviewer prompt', async () => {
  const proDigests = [];
  const updates = [];

  const assistant = createMeetingAssistant({
    settings: {
      userTier: 'pro',
      proAgentEnabled: true,
      transcriptionApiKey: 'openai-key',
      llmApiKey: 'openai-key',
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'fallback-model'
    },
    testProIntent: true,
    proAgent: {
      run: async (payload) => {
        proDigests.push(payload.digest);
        return {
          ok: true,
          text: '{"answers":[{"question":"Q","bullets":["A"]}]}',
          cards: [{ type: 'answer', title: 'Answer', question: 'Q', bullets: ['A'] }],
          toolCalls: 0
        };
      }
    },
    axiosClient: {
      post: async () => {
        throw new Error('free path should not run');
      }
    },
    intervalMs: 0,
    utteranceSettleMs: 20,
    incompleteUtteranceSettleMs: 50,
    sendUpdate: (update) => updates.push(update)
  });

  const firstFragment = await assistant.addTranscript({
    speaker: 'System Audio',
    text: 'Can you describe a challenging incident you managed at Sigma and'
  });

  assert.equal(firstFragment.skipped, 'waiting-for-utterance');
  await new Promise((resolve) => setTimeout(resolve, 90));
  assert.equal(proDigests.length, 0);
  assert.equal(updates.length, 0);

  await assistant.addTranscript({
    speaker: 'System Audio',
    text: 'how you approached it?'
  });

  await waitFor(() => proDigests.length === 1, 3500);
  assert.match(proDigests[0], /Can you describe a challenging incident you managed at Sigma and/);
  assert.match(proDigests[0], /how you approached it\?/);
});

test('pro automatic assist does not answer partial ASR prompts before terminal punctuation', async () => {
  const proPayloads = [];

  const assistant = createMeetingAssistant({
    settings: {
      userTier: 'pro',
      proAgentEnabled: true,
      transcriptionApiKey: 'openai-key',
      llmApiKey: 'openai-key',
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'fallback-model'
    },
    testProIntent: true,
    proAgent: {
      run: async (payload) => {
        proPayloads.push(payload);
        return {
          ok: true,
          text: '{"answers":[{"question":"Q","bullets":["A"]}]}',
          cards: [{ type: 'answer', title: 'Answer', question: 'Q', bullets: ['A'] }],
          toolCalls: 0
        };
      }
    },
    axiosClient: {
      post: async () => {
        throw new Error('free path should not run');
      }
    },
    intervalMs: 0,
    utteranceSettleMs: 1
  });

  await assistant.addTranscript({
    speaker: 'System Audio',
    text: 'Can you walk me through a time When you audited'
  });

  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(proPayloads.length, 0);

  await assistant.addTranscript({
    speaker: 'System Audio',
    text: 'and or optimized a CRM or ticketing system to improve frontline agent efficiency.'
  });

  await waitFor(() => proPayloads.length === 1, 500);
  assert.equal(proPayloads[0].targetQuestion, 'Can you walk me through a time When you audited and or optimized a CRM or ticketing system to improve frontline agent efficiency.');
});

test('pro partial gate combines short follow-up prompts with the prior interviewer setup', async () => {
  const proPayloads = [];

  const assistant = createMeetingAssistant({
    settings: {
      userTier: 'pro',
      proAgentEnabled: true,
      transcriptionApiKey: 'openai-key',
      llmApiKey: 'openai-key',
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'fallback-model'
    },
    proAgent: {
      run: async (payload) => {
        proPayloads.push(payload);
        return {
          ok: true,
          text: '{"answers":[{"question":"Q","bullets":["A","B","C"]}]}',
          cards: [{ type: 'answer', title: 'Answer', question: 'Q', bullets: ['A', 'B', 'C'] }],
          toolCalls: 0
        };
      }
    },
    axiosClient: {
      post: async () => {
        throw new Error('free path should not run');
      }
    },
    intervalMs: 0
  });

  await assistant.addTranscript({
    speaker: 'System Audio',
    text: "Tell me about maybe one of the hardest personnel decisions you've had to make as a manager"
  });

  await assistant.addPartialTranscript({
    speaker: 'System Audio',
    text: 'And what happened?',
    partial: true,
    itemId: 'follow-up-1'
  });

  await waitFor(() => proPayloads.length === 1, 1000);
  assert.equal(
    proPayloads[0].targetQuestion,
    "Tell me about maybe one of the hardest personnel decisions you've had to make as a manager And what happened?"
  );
  assert.match(proPayloads[0].digest, /hardest personnel decisions/);
  assert.match(proPayloads[0].digest, /And what happened\?/);
});

test('pro final transcript gate continues answering later questions', async () => {
  const proPayloads = [];

  const assistant = createMeetingAssistant({
    settings: {
      userTier: 'pro',
      proAgentEnabled: true,
      transcriptionApiKey: 'openai-key',
      llmApiKey: 'openai-key',
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'fallback-model'
    },
    proAgent: {
      run: async (payload) => {
        proPayloads.push(payload);
        return {
          ok: true,
          text: '{"answers":[{"question":"Q","bullets":["A","B","C"]}]}',
          cards: [{ type: 'answer', title: 'Answer', question: 'Q', bullets: ['A', 'B', 'C'] }],
          toolCalls: 0
        };
      }
    },
    axiosClient: {
      post: async () => {
        throw new Error('free path should not run');
      }
    },
    intervalMs: 0
  });

  await assistant.addTranscript({
    speaker: 'System Audio',
    text: 'Can you describe your management style?',
    itemId: 'final-1'
  });

  await assistant.addTranscript({
    speaker: 'System Audio',
    text: 'Can you give an example of a hard personnel decision?',
    itemId: 'final-2'
  });

  await waitFor(() => proPayloads.length === 2, 1000);
  assert.equal(proPayloads[0].targetQuestion, 'Can you describe your management style?');
  assert.equal(proPayloads[1].targetQuestion, 'Can you give an example of a hard personnel decision?');
});

test('pro queued forced run skips duplicate after draft is already shown', async () => {
  const proPayloads = [];
  const updates = [];
  let releaseFirstRun;
  let firstRunStarted;
  const firstRunStartedPromise = new Promise((resolve) => {
    firstRunStarted = resolve;
  });

  const assistant = createMeetingAssistant({
    settings: {
      userTier: 'pro',
      proAgentEnabled: true,
      transcriptionApiKey: 'openai-key',
      llmApiKey: 'openai-key',
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'fallback-model'
    },
    proAgent: {
      run: async (payload) => {
        proPayloads.push(payload);
        payload.onDraft?.({
          text: 'draft',
          cards: [{
            id: payload.draftCardId,
            type: 'answer',
            title: 'Answer',
            question: payload.targetQuestion,
            bullets: ['A', 'B', 'C'],
            draft: true
          }]
        });
        if (proPayloads.length === 1) {
          firstRunStarted();
          await new Promise((resolve) => {
            releaseFirstRun = resolve;
          });
        }
        return {
          ok: true,
          text: '{"answers":[{"question":"Q","bullets":["A","B","C"]}]}',
          cards: [{
            type: 'answer',
            title: 'Answer',
            question: payload.targetQuestion,
            bullets: ['A', 'B', 'C']
          }],
          toolCalls: 0
        };
      }
    },
    axiosClient: {
      post: async () => {
        throw new Error('free path should not run');
      }
    },
    intervalMs: 0,
    sendUpdate: (update) => updates.push(update)
  });

  await assistant.addPartialTranscript({
    speaker: 'System Audio',
    text: 'Can you describe how you evaluate downstream effects on other systems or teams?',
    partial: true,
    itemId: 'duplicate-question'
  });

  await firstRunStartedPromise;
  assert.equal(proPayloads.length, 1);
  assert.equal(updates.length, 1);

  await assistant.addTranscript({
    speaker: 'System Audio',
    text: 'can you describe how you evaluate downstream effects on other systems or teams?',
    itemId: 'duplicate-question'
  });

  releaseFirstRun();
  await new Promise((resolve) => setTimeout(resolve, 80));

  assert.equal(proPayloads.length, 1);
  assert.equal(updates.length, 1);
});

test('pro queued forced run skips duplicate continuation from a new item after first draft displays', async () => {
  const proPayloads = [];
  const updates = [];
  let releaseFirstRun;
  let firstRunStarted;
  const firstRunStartedPromise = new Promise((resolve) => {
    firstRunStarted = resolve;
  });

  const assistant = createMeetingAssistant({
    settings: {
      userTier: 'pro',
      proAgentEnabled: true,
      transcriptionApiKey: 'openai-key',
      llmApiKey: 'openai-key',
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'fallback-model'
    },
    proAgent: {
      run: async (payload) => {
        proPayloads.push(payload);
        if (proPayloads.length === 1) {
          firstRunStarted();
          await new Promise((resolve) => {
            releaseFirstRun = resolve;
          });
        }
        payload.onDraft?.({
          text: 'draft',
          cards: [{
            id: payload.draftCardId,
            type: 'answer',
            title: 'Answer',
            question: payload.targetQuestion,
            bullets: ['I audited the CRM workflow.', 'I removed repeated agent steps.', 'I measured the rollout impact.'],
            draft: true
          }]
        });
        return {
          ok: true,
          text: 'answer',
          cards: [{
            type: 'answer',
            title: 'Answer',
            question: payload.targetQuestion,
            bullets: ['I audited the CRM workflow.', 'I removed repeated agent steps.', 'I measured the rollout impact.']
          }],
          toolCalls: 0
        };
      }
    },
    intervalMs: 0,
    sendUpdate: (update) => updates.push(update)
  });

  await assistant.addTranscript({
    speaker: 'System Audio',
    text: 'Can you walk me through a time when you audited or optimized a CRM or ticketing system?',
    itemId: 'crm-early'
  });

  await firstRunStartedPromise;

  await assistant.addTranscript({
    speaker: 'System Audio',
    text: 'Can you walk me through a time when you audited or optimized a CRM or ticketing system to improve frontline performance?',
    itemId: 'crm-fuller'
  });

  releaseFirstRun();
  await new Promise((resolve) => setTimeout(resolve, 100));

  assert.equal(proPayloads.length, 1);
  assert.equal(updates.filter((update) => update.cards?.[0]?.type === 'answer').length, 1);
});

test('pro gate combines realtime final fragments before answering', async () => {
  const proPayloads = [];

  const assistant = createMeetingAssistant({
    settings: {
      userTier: 'pro',
      proAgentEnabled: true,
      transcriptionApiKey: 'openai-key',
      llmApiKey: 'openai-key',
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'fallback-model'
    },
    proAgent: {
      run: async (payload) => {
        proPayloads.push(payload);
        return {
          ok: true,
          text: '{"answers":[{"question":"Q","bullets":["A","B","C"]}]}',
          cards: [{ type: 'answer', title: 'Answer', question: 'Q', bullets: ['A', 'B', 'C'] }],
          toolCalls: 0
        };
      }
    },
    axiosClient: {
      post: async () => {
        throw new Error('free path should not run');
      }
    },
    intervalMs: 0
  });

  await assistant.addTranscript({ speaker: 'System Audio', text: 'Can you describe a time', itemId: 'api-1' });
  await assistant.addTranscript({ speaker: 'System Audio', text: 'you designed or', itemId: 'api-2' });
  await assistant.addTranscript({ speaker: 'System Audio', text: 'maintained an API-based integration', itemId: 'api-3' });
  await assistant.addTranscript({ speaker: 'System Audio', text: 'between customer experience platform', itemId: 'api-4' });
  await assistant.addTranscript({
    speaker: 'System Audio',
    text: 'another internal system. I know you kind of already talked through that',
    itemId: 'api-5'
  });
  await assistant.addTranscript({ speaker: 'System Audio', text: 'Um, but if you do have', itemId: 'api-6' });
  await assistant.addPartialTranscript({
    speaker: 'System Audio',
    text: 'Are there maybe another example or going deeper into that one?',
    partial: true,
    itemId: 'api-7'
  });

  await waitFor(() => proPayloads.length === 1, 1000);
  assert.equal(
    proPayloads[0].targetQuestion,
    'Can you describe a time you designed or maintained an API-based integration between customer experience platform and another internal system. I know you kind of already talked through that Um, but if you do have Are there maybe another example or going deeper into that one?'
  );
});

test('pro partial gate cancels a queued draft when later partial text becomes incomplete', async () => {
  const proPayloads = [];

  const assistant = createMeetingAssistant({
    settings: {
      userTier: 'pro',
      proAgentEnabled: true,
      transcriptionApiKey: 'openai-key',
      llmApiKey: 'openai-key',
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'fallback-model'
    },
    proAgent: {
      run: async (payload) => {
        proPayloads.push(payload);
        return {
          ok: true,
          text: '{"answers":[{"question":"Q","bullets":["A","B","C"]}]}',
          cards: [{ type: 'answer', title: 'Answer', question: 'Q', bullets: ['A', 'B', 'C'] }],
          toolCalls: 0
        };
      }
    },
    axiosClient: {
      post: async () => {
        throw new Error('free path should not run');
      }
    },
    intervalMs: 0
  });

  await assistant.addTranscript({
    speaker: 'System Audio',
    text: 'Can you tell me about a time you had to align stakeholders across',
    itemId: 'align-setup'
  });

  await assistant.addPartialTranscript({
    speaker: 'System Audio',
    text: 'product or engineering.',
    partial: true,
    itemId: 'align-continuation'
  });

  await assistant.addPartialTranscript({
    speaker: 'System Audio',
    text: 'product or engineering. Um',
    partial: true,
    itemId: 'align-continuation'
  });

  await new Promise((resolve) => setTimeout(resolve, 240));
  assert.equal(proPayloads.length, 0);

  await assistant.addPartialTranscript({
    speaker: 'System Audio',
    text: 'product or engineering. Um and operations on a technical project where the priorities conflicted. And how did you navigate that?',
    partial: true,
    itemId: 'align-continuation'
  });

  await waitFor(() => proPayloads.length === 1, 1000);
  assert.equal(
    proPayloads[0].targetQuestion,
    'Can you tell me about a time you had to align stakeholders across product or engineering. Um and operations on a technical project where the priorities conflicted. And how did you navigate that?'
  );
});

test('pro gate ignores interviewer setup chatter before the first actual question', async () => {
  const proPayloads = [];

  const assistant = createMeetingAssistant({
    settings: {
      userTier: 'pro',
      proAgentEnabled: true,
      transcriptionApiKey: 'openai-key',
      llmApiKey: 'openai-key',
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'fallback-model'
    },
    proAgent: {
      run: async (payload) => {
        proPayloads.push(payload);
        return {
          ok: true,
          text: '{"answers":[{"question":"Q","bullets":["A","B","C"]}]}',
          cards: [{ type: 'answer', title: 'Answer', question: 'Q', bullets: ['A', 'B', 'C'] }],
          toolCalls: 0
        };
      }
    },
    intervalMs: 0
  });

  await assistant.addPartialTranscript({
    speaker: 'System Audio',
    text: "I have some questions I will go through. They're mostly like tell me about a time when type questions. I'm looking for like specific examples so I can get an understanding of what exactly you did versus the team and what the impact was and things like that.",
    partial: true,
    itemId: 'setup'
  });

  await new Promise((resolve) => setTimeout(resolve, 240));
  assert.equal(proPayloads.length, 0);
});

test('pro gate starts fresh after user speech and accepts walk me through process without punctuation', async () => {
  const proPayloads = [];

  const assistant = createMeetingAssistant({
    settings: {
      userTier: 'pro',
      proAgentEnabled: true,
      transcriptionApiKey: 'openai-key',
      llmApiKey: 'openai-key',
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'fallback-model'
    },
    proAgent: {
      run: async (payload) => {
        proPayloads.push(payload);
        return {
          ok: true,
          text: '{"answers":[{"question":"Q","bullets":["A","B","C"]}]}',
          cards: [{ type: 'answer', title: 'Answer', question: 'Q', bullets: ['A', 'B', 'C'] }],
          toolCalls: 0
        };
      }
    },
    intervalMs: 0
  });

  await assistant.addTranscript({
    speaker: 'System Audio',
    text: 'Can you tell me about a time you had to align stakeholders across product engineering and operations on a technical project where the priorities conflicted. And how did you navigate that?',
    itemId: 'first-question'
  });
  await waitFor(() => proPayloads.length === 1, 1000);

  await assistant.addTranscript({ speaker: 'You', text: 'Yeah', itemId: 'candidate-answer' });
  await assistant.addTranscript({ speaker: 'System Audio', text: 'How do you evaluate whether a', itemId: 'process-1' });
  await assistant.addTranscript({ speaker: 'System Audio', text: 'change or tool or workflow', itemId: 'process-2' });
  await assistant.addTranscript({ speaker: 'System Audio', text: 'will have downstream effects on', itemId: 'process-3' });
  await assistant.addTranscript({ speaker: 'System Audio', text: 'other systems or teams', itemId: 'process-4' });
  await assistant.addPartialTranscript({
    speaker: 'System Audio',
    text: 'Walk me through your process',
    partial: true,
    itemId: 'process-5'
  });

  await waitFor(() => proPayloads.length === 2, 1500);
  assert.equal(
    proPayloads[1].targetQuestion,
    'How do you evaluate whether a change or tool or workflow will have downstream effects on other systems or teams Walk me through your process'
  );
});

test('pro gate does not carry a completed question forward after trailing acknowledgement', async () => {
  const proPayloads = [];

  const assistant = createMeetingAssistant({
    settings: {
      userTier: 'pro',
      proAgentEnabled: true,
      transcriptionApiKey: 'openai-key',
      llmApiKey: 'openai-key',
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'fallback-model'
    },
    proAgent: {
      run: async (payload) => {
        proPayloads.push(payload);
        return {
          ok: true,
          text: '{"answers":[{"question":"Q","bullets":["A","B","C"]}]}',
          cards: [{ type: 'answer', title: 'Answer', question: 'Q', bullets: ['A', 'B', 'C'] }],
          toolCalls: 0
        };
      }
    },
    intervalMs: 0
  });

  await assistant.addTranscript({
    speaker: 'System Audio',
    text: 'And then have you had an experience integrating Gen AI or other automation tools directly into customer support workflows. Yeah',
    itemId: 'genai'
  });

  await waitFor(() => proPayloads.length === 1, 1500);
  assert.equal(
    proPayloads[0].targetQuestion,
    'And then have you had an experience integrating Gen AI or other automation tools directly into customer support workflows.'
  );

  await assistant.addPartialTranscript({ speaker: 'System Audio', text: 'Can you', partial: true, itemId: 'stakeholder-1' });
  await new Promise((resolve) => setTimeout(resolve, 240));
  assert.equal(proPayloads.length, 1);

  await assistant.addPartialTranscript({
    speaker: 'System Audio',
    text: 'Can you tell me about a time you had to align stakeholders across product engineering and operations on a technical project where the priorities conflicted. And how did you navigate that?',
    partial: true,
    itemId: 'stakeholder-1'
  });

  await waitFor(() => proPayloads.length === 2, 1000);
  assert.equal(
    proPayloads[1].targetQuestion,
    'Can you tell me about a time you had to align stakeholders across product engineering and operations on a technical project where the priorities conflicted. And how did you navigate that?'
  );
});

test('pro final replacement keeps draft bullets and adds new memory detail', async () => {
  const updates = [];
  let runCount = 0;

  const assistant = createMeetingAssistant({
    settings: {
      userTier: 'pro',
      proAgentEnabled: true,
      transcriptionApiKey: 'openai-key',
      llmApiKey: 'openai-key',
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'fallback-model',
      ragEnabled: true
    },
    proAgent: {
      searchMemoryCards: async () => ({
        contextText: 'Memory says the rollout reduced handle time by 32%.',
        cards: []
      }),
      run: async (payload) => {
        runCount += 1;
        if (runCount === 1) {
          payload.onDraft?.({
            text: 'draft',
            cards: [{
              id: payload.draftCardId,
              type: 'answer',
              title: 'Draft answer',
              question: 'Can you walk me through the CRM audit?',
              bullets: ['I audited the CRM workflow.', 'I removed repeated agent steps.', 'I measured the impact after rollout.'],
              draft: true
            }]
          });
          return {
            ok: true,
            text: 'draft',
            cards: [{
              type: 'answer',
              title: 'Say next',
              question: 'Can you walk me through the CRM audit?',
              bullets: ['I audited the CRM workflow.', 'I removed repeated agent steps.', 'I measured the impact after rollout.']
            }],
            toolCalls: 0
          };
        }
        return {
          ok: true,
          text: 'final',
          cards: [{
            type: 'answer',
            title: 'Say next',
            question: 'Can you walk me through the CRM audit?',
            bullets: [
              'I audited the CRM workflow.',
              'I removed repeated agent steps.',
              'I measured the impact after rollout.',
              'The rollout reduced handle time by 32%.'
            ]
          }],
          toolCalls: 0
        };
      }
    },
    sendUpdate: (update) => updates.push(update),
    intervalMs: 0,
    proFinalMemoryWaitMs: 10
  });

  await assistant.addTranscript({
    speaker: 'System Audio',
    text: 'Can you walk me through the CRM audit?',
    itemId: 'crm-audit'
  });

  await waitFor(() => updates.filter((update) => update.cards?.[0]?.type === 'answer').length === 2, 1000);
  const finalCard = updates[1].cards[0];
  assert.deepEqual(finalCard.bullets, [
    'I audited the CRM workflow.',
    'I removed repeated agent steps.',
    'I measured the impact after rollout.'
  ]);
  assert.equal(finalCard.title, 'Say next');
  assert.equal(finalCard.draft, undefined);
  assert.deepEqual(finalCard.detailBullets, ['The rollout reduced handle time by 32%.']);
});

test('pro final replacement extracts embedded supplemental detail without changing draft bullets', async () => {
  const updates = [];
  let runCount = 0;

  const assistant = createMeetingAssistant({
    settings: {
      userTier: 'pro',
      proAgentEnabled: true,
      transcriptionApiKey: 'openai-key',
      llmApiKey: 'openai-key',
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'fallback-model',
      ragEnabled: true
    },
    proAgent: {
      searchMemoryCards: async () => ({
        contextText: 'Memory says failing API calls were visible in Power BI.',
        cards: []
      }),
      run: async (payload) => {
        runCount += 1;
        if (runCount === 1) {
          payload.onDraft?.({
            text: 'draft',
            cards: [{
              id: payload.draftCardId,
              type: 'answer',
              title: 'Draft answer',
              question: 'Can you describe an API integration?',
              bullets: [
                'I connected Freshdesk with Jira so engineering work could be created from support context.',
                'I used dynamic forms to route the right request to the right engineering pod.',
                'I monitored reliability and fixed failures quickly.'
              ],
              draft: true
            }]
          });
          return {
            ok: true,
            text: 'draft',
            cards: [{
              type: 'answer',
              title: 'Say next',
              question: 'Can you describe an API integration?',
              bullets: [
                'I connected Freshdesk with Jira so engineering work could be created from support context.',
                'I used dynamic forms to route the right request to the right engineering pod.',
                'I monitored reliability and fixed failures quickly.'
              ]
            }],
            toolCalls: 0
          };
        }
        return {
          ok: true,
          text: 'final',
          cards: [{
            type: 'answer',
            title: 'Say next',
            question: 'Can you describe an API integration?',
            bullets: [
              'I connected Freshdesk with Jira so engineering work could be created from support context.',
              'I used dynamic forms to route the right request to the right engineering pod.',
              'I monitored reliability and fixed failures quickly, with failing API calls visible in Power BI for faster troubleshooting.'
            ]
          }],
          toolCalls: 0
        };
      }
    },
    sendUpdate: (update) => updates.push(update),
    intervalMs: 0,
    proFinalMemoryWaitMs: 10
  });

  await assistant.addTranscript({
    speaker: 'System Audio',
    text: 'Can you describe an API integration?',
    itemId: 'api-detail'
  });

  await waitFor(() => updates.filter((update) => update.cards?.[0]?.type === 'answer').length === 2, 1000);
  const finalCard = updates[1].cards[0];
  assert.deepEqual(finalCard.bullets, [
    'I connected Freshdesk with Jira so engineering work could be created from support context.',
    'I used dynamic forms to route the right request to the right engineering pod.',
    'I monitored reliability and fixed failures quickly.'
  ]);
  assert.deepEqual(finalCard.detailBullets, ['with failing API calls visible in Power BI for faster troubleshooting.']);
});

test('pro final replacement filters dangling detail fragments', async () => {
  const updates = [];
  let runCount = 0;

  const assistant = createMeetingAssistant({
    settings: {
      userTier: 'pro',
      proAgentEnabled: true,
      transcriptionApiKey: 'openai-key',
      llmApiKey: 'openai-key',
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'fallback-model',
      ragEnabled: true
    },
    proAgent: {
      searchMemoryCards: async () => ({
        contextText: 'Memory says the work reduced resolution time by 38%.',
        cards: []
      }),
      run: async (payload) => {
        runCount += 1;
        if (runCount === 1) {
          payload.onDraft?.({
            text: 'draft',
            cards: [{
              id: payload.draftCardId,
              type: 'answer',
              title: 'Draft answer',
              question: 'Have you integrated automation into support?',
              bullets: [
                'I introduced automation into support workflows.',
                'I built routing logic with escalation paths.',
                'I measured outcomes after rollout.'
              ],
              draft: true
            }]
          });
          return {
            ok: true,
            text: 'draft',
            cards: [{
              type: 'answer',
              title: 'Say next',
              question: 'Have you integrated automation into support?',
              bullets: [
                'I introduced automation into support workflows.',
                'I built routing logic with escalation paths.',
                'I measured outcomes after rollout.'
              ]
            }],
            toolCalls: 0
          };
        }
        return {
          ok: true,
          text: 'final',
          cards: [{
            type: 'answer',
            title: 'Say next',
            question: 'Have you integrated automation into support?',
            bullets: [
              'I introduced automation into support workflows, I focus on safe rollout patterns by using clear routing.',
              'I built routing logic with escalation paths, which reduced resolution time by 38%.',
              'I measured outcomes after rollout, I measured success with operational.'
            ]
          }],
          toolCalls: 0
        };
      }
    },
    sendUpdate: (update) => updates.push(update),
    intervalMs: 0,
    proFinalMemoryWaitMs: 10
  });

  await assistant.addTranscript({
    speaker: 'System Audio',
    text: 'Have you integrated automation into support?',
    itemId: 'automation-detail'
  });

  await waitFor(() => updates.filter((update) => update.cards?.[0]?.type === 'answer').length === 2, 1000);
  const finalCard = updates[1].cards[0];
  assert.deepEqual(finalCard.detailBullets, ['reduced resolution time by 38%.']);
});

test('pro final replacement is skipped when final matches draft', async () => {
  const updates = [];
  let runCount = 0;

  const assistant = createMeetingAssistant({
    settings: {
      userTier: 'pro',
      proAgentEnabled: true,
      transcriptionApiKey: 'openai-key',
      llmApiKey: 'openai-key',
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'fallback-model',
      ragEnabled: true
    },
    proAgent: {
      searchMemoryCards: async () => ({
        contextText: 'Similar memory.',
        cards: []
      }),
      run: async (payload) => {
        runCount += 1;
        const card = {
          type: 'answer',
          title: runCount === 1 ? 'Draft answer' : 'Say next',
          question: 'Can you walk me through the CRM audit?',
          bullets: ['I audited the CRM workflow.', 'I removed repeated agent steps.', 'I measured the impact after rollout.']
        };
        if (runCount === 1) {
          payload.onDraft?.({ text: 'draft', cards: [{ ...card, id: payload.draftCardId, draft: true }] });
        }
        return { ok: true, text: 'answer', cards: [card], toolCalls: 0 };
      }
    },
    sendUpdate: (update) => updates.push(update),
    intervalMs: 0,
    proFinalMemoryWaitMs: 10
  });

  await assistant.addTranscript({
    speaker: 'System Audio',
    text: 'Can you walk me through the CRM audit?',
    itemId: 'crm-audit'
  });

  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(runCount, 2);
  assert.equal(updates.filter((update) => update.cards?.[0]?.type === 'answer').length, 1);
});

test('pro gate treats another example going deeper as a complete follow-up prompt', async () => {
  const proPayloads = [];

  const assistant = createMeetingAssistant({
    settings: {
      userTier: 'pro',
      proAgentEnabled: true,
      transcriptionApiKey: 'openai-key',
      llmApiKey: 'openai-key',
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'fallback-model'
    },
    proAgent: {
      run: async (payload) => {
        proPayloads.push(payload);
        return {
          ok: true,
          text: '{"answers":[{"question":"Q","bullets":["A","B","C"]}]}',
          cards: [{ type: 'answer', title: 'Answer', question: 'Q', bullets: ['A', 'B', 'C'] }],
          toolCalls: 0
        };
      }
    },
    intervalMs: 0
  });

  await assistant.addTranscript({ speaker: 'System Audio', text: 'Can you describe a time', itemId: 'api-1' });
  await assistant.addTranscript({ speaker: 'System Audio', text: 'you designed or', itemId: 'api-2' });
  await assistant.addTranscript({ speaker: 'System Audio', text: 'maintained an API based integration', itemId: 'api-3' });
  await assistant.addTranscript({ speaker: 'System Audio', text: 'between customer experience platform', itemId: 'api-4' });
  await assistant.addTranscript({
    speaker: 'System Audio',
    text: 'another internal system. I know you kind of already talked through that',
    itemId: 'api-5'
  });
  await assistant.addTranscript({ speaker: 'System Audio', text: 'But if you do have either', itemId: 'api-6' });
  await assistant.addPartialTranscript({
    speaker: 'System Audio',
    text: 'maybe another example or going deeper into that one',
    partial: true,
    itemId: 'api-7'
  });

  await waitFor(() => proPayloads.length === 1, 1500);
  assert.equal(
    proPayloads[0].targetQuestion,
    'Can you describe a time you designed or maintained an API based integration between customer experience platform and another internal system. I know you kind of already talked through that But if you do have either maybe another example or going deeper into that one'
  );
});

test('pro gate treats common no-punctuation question endings as complete', async () => {
  const proPayloads = [];

  const assistant = createMeetingAssistant({
    settings: {
      userTier: 'pro',
      proAgentEnabled: true,
      transcriptionApiKey: 'openai-key',
      llmApiKey: 'openai-key',
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'fallback-model'
    },
    proAgent: {
      run: async (payload) => {
        proPayloads.push(payload);
        return {
          ok: true,
          text: '{"answers":[{"question":"Q","bullets":["A","B","C"]}]}',
          cards: [{ type: 'answer', title: 'Answer', question: 'Q', bullets: ['A', 'B', 'C'] }],
          toolCalls: 0
        };
      }
    },
    intervalMs: 0
  });

  await assistant.addTranscript({ speaker: 'System Audio', text: 'Can you walk me through a time', itemId: 'crm-1' });
  await assistant.addPartialTranscript({
    speaker: 'System Audio',
    text: 'When you audited or optimized a CRM or ticketing system to improve frontline efficient',
    partial: true,
    itemId: 'crm-2'
  });

  await waitFor(() => proPayloads.length === 1, 1500);
  assert.equal(
    proPayloads[0].targetQuestion,
    'Can you walk me through a time When you audited or optimized a CRM or ticketing system to improve frontline efficient'
  );

  await assistant.addTranscript({
    speaker: 'System Audio',
    text: 'And then have you had an integrating GenAI or other automation tools directly into customer support workflows yeah',
    itemId: 'genai'
  });

  await waitFor(() => proPayloads.length === 2, 1500);
  assert.equal(
    proPayloads[1].targetQuestion,
    'And then have you had an integrating GenAI or other automation tools directly into customer support workflows'
  );
});

test('pro gate treats deflect common queries as a complete AI agents question', async () => {
  const proPayloads = [];

  const assistant = createMeetingAssistant({
    settings: {
      userTier: 'pro',
      proAgentEnabled: true,
      transcriptionApiKey: 'openai-key',
      llmApiKey: 'openai-key',
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'fallback-model'
    },
    proAgent: {
      run: async (payload) => {
        proPayloads.push(payload);
        return {
          ok: true,
          text: '{"answers":[{"question":"Q","bullets":["A","B","C"]}]}',
          cards: [{ type: 'answer', title: 'Answer', question: 'Q', bullets: ['A', 'B', 'C'] }],
          toolCalls: 0
        };
      }
    },
    intervalMs: 0
  });

  await assistant.addTranscript({ speaker: 'System Audio', text: 'Have you explored using AI agents like Fin', itemId: 'fin-1' });
  await assistant.addPartialTranscript({
    speaker: 'System Audio',
    text: 'To deflect common queries',
    partial: true,
    itemId: 'fin-2'
  });

  await waitFor(() => proPayloads.length === 1, 1500);
  assert.equal(
    proPayloads[0].targetQuestion,
    'Have you explored using AI agents like Fin To deflect common queries'
  );
});

test('pro gate keeps pending interviewer prompt across tiny user filler', async () => {
  const proPayloads = [];

  const assistant = createMeetingAssistant({
    settings: {
      userTier: 'pro',
      proAgentEnabled: true,
      transcriptionApiKey: 'openai-key',
      llmApiKey: 'openai-key',
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'fallback-model'
    },
    proAgent: {
      run: async (payload) => {
        proPayloads.push(payload);
        return {
          ok: true,
          text: '{"answers":[{"question":"Q","bullets":["A","B","C"]}]}',
          cards: [{ type: 'answer', title: 'Answer', question: 'Q', bullets: ['A', 'B', 'C'] }],
          toolCalls: 0
        };
      }
    },
    intervalMs: 0
  });

  await assistant.addTranscript({ speaker: 'System Audio', text: 'Have you explored using AI agents like Fin', itemId: 'fin-1' });
  await assistant.addTranscript({ speaker: 'You', text: 'just', itemId: 'candidate-filler' });
  await assistant.addTranscript({ speaker: 'System Audio', text: 'To deflect common queries', itemId: 'fin-2' });

  await waitFor(() => proPayloads.length === 1, 1500);
  assert.equal(
    proPayloads[0].targetQuestion,
    'Have you explored using AI agents like Fin To deflect common queries'
  );
});

test('pro gate keeps pending interviewer prompt when prior run finishes', async () => {
  const proPayloads = [];
  let resolveFirstRun;

  const assistant = createMeetingAssistant({
    settings: {
      userTier: 'pro',
      proAgentEnabled: true,
      transcriptionApiKey: 'openai-key',
      llmApiKey: 'openai-key',
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'fallback-model'
    },
    proAgent: {
      run: async (payload) => {
        proPayloads.push(payload);
        if (proPayloads.length === 1) {
          await new Promise((resolve) => {
            resolveFirstRun = resolve;
          });
        }
        return {
          ok: true,
          text: '{"answers":[{"question":"Q","bullets":["A","B","C"]}]}',
          cards: [{ type: 'answer', title: 'Answer', question: 'Q', bullets: ['A', 'B', 'C'] }],
          toolCalls: 0
        };
      }
    },
    intervalMs: 0
  });

  await assistant.addTranscript({ speaker: 'System Audio', text: 'How do you handle self-service and documentation?', itemId: 'docs-1' });
  await waitFor(() => proPayloads.length === 1, 1000);
  await assistant.addTranscript({ speaker: 'System Audio', text: 'Have you explored using AI agents like Fin', itemId: 'fin-1' });
  resolveFirstRun();
  await new Promise((resolve) => setTimeout(resolve, 20));
  await assistant.addTranscript({ speaker: 'System Audio', text: 'To deflect common queries', itemId: 'fin-2' });

  await waitFor(() => proPayloads.length === 2, 1500);
  assert.equal(
    proPayloads[1].targetQuestion,
    'Have you explored using AI agents like Fin To deflect common queries'
  );
});

test('pro gate accepts tight deadlines prompt without merging later question', async () => {
  const proPayloads = [];

  const assistant = createMeetingAssistant({
    settings: {
      userTier: 'pro',
      proAgentEnabled: true,
      transcriptionApiKey: 'openai-key',
      llmApiKey: 'openai-key',
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'fallback-model'
    },
    proAgent: {
      run: async (payload) => {
        proPayloads.push(payload);
        return {
          ok: true,
          text: '{"answers":[{"question":"Q","bullets":["A","B","C"]}]}',
          cards: [{ type: 'answer', title: 'Answer', question: 'Q', bullets: ['A', 'B', 'C'] }],
          toolCalls: 0
        };
      }
    },
    intervalMs: 0
  });

  await assistant.addTranscript({
    speaker: 'System Audio',
    text: "How would you manage your critical tasks to maintain high quality service when you're working under pressure to meet tight deadlines",
    itemId: 'deadline-1'
  });

  await waitFor(() => proPayloads.length === 1, 1500);
  assert.equal(
    proPayloads[0].targetQuestion,
    "How would you manage your critical tasks to maintain high quality service when you're working under pressure to meet tight deadlines"
  );
});

test('pro gate waits on open purpose clauses before firing', async () => {
  const proPayloads = [];

  const assistant = createMeetingAssistant({
    settings: {
      userTier: 'pro',
      proAgentEnabled: true,
      transcriptionApiKey: 'openai-key',
      llmApiKey: 'openai-key',
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'fallback-model'
    },
    proAgent: {
      run: async (payload) => {
        proPayloads.push(payload);
        return {
          ok: true,
          text: '{"answers":[{"question":"Q","bullets":["A","B","C"]}]}',
          cards: [{ type: 'answer', title: 'Answer', question: 'Q', bullets: ['A', 'B', 'C'] }],
          toolCalls: 0
        };
      }
    },
    intervalMs: 0
  });

  await assistant.addTranscript({
    speaker: 'System Audio',
    text: 'How would you manage customer escalations to maintain high service quality',
    itemId: 'purpose-1'
  });

  await new Promise((resolve) => setTimeout(resolve, 1500));
  assert.equal(proPayloads.length, 0);

  await assistant.addTranscript({
    speaker: 'System Audio',
    text: "when you're working under pressure to meet tight deadlines",
    itemId: 'purpose-2'
  });

  await waitFor(() => proPayloads.length === 1, 1500);
  assert.equal(
    proPayloads[0].targetQuestion,
    "How would you manage customer escalations to maintain high service quality when you're working under pressure to meet tight deadlines"
  );
});

test('pro gate waits on open connector verb fragments', async () => {
  const proPayloads = [];

  const assistant = createMeetingAssistant({
    settings: {
      userTier: 'pro',
      proAgentEnabled: true,
      transcriptionApiKey: 'openai-key',
      llmApiKey: 'openai-key',
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'fallback-model'
    },
    proAgent: {
      run: async (payload) => {
        proPayloads.push(payload);
        return {
          ok: true,
          text: '{"answers":[{"question":"Q","bullets":["A","B","C"]}]}',
          cards: [{ type: 'answer', title: 'Answer', question: 'Q', bullets: ['A', 'B', 'C'] }],
          toolCalls: 0
        };
      }
    },
    intervalMs: 0
  });

  await assistant.addTranscript({
    speaker: 'System Audio',
    text: 'How do you typically go about managing that or turn',
    itemId: 'verb-fragment-1'
  });

  await new Promise((resolve) => setTimeout(resolve, 1500));
  assert.equal(proPayloads.length, 0);

  await assistant.addTranscript({
    speaker: 'System Audio',
    text: 'it into a repeatable coaching process?',
    itemId: 'verb-fragment-2'
  });

  await waitFor(() => proPayloads.length === 1, 1000);
  assert.equal(
    proPayloads[0].targetQuestion,
    'How do you typically go about managing that or turn it into a repeatable coaching process?'
  );
});

test('pro target cleanup repairs malformed auxiliary follow-up leads', async () => {
  const proPayloads = [];

  const assistant = createMeetingAssistant({
    settings: {
      userTier: 'pro',
      proAgentEnabled: true,
      transcriptionApiKey: 'openai-key',
      llmApiKey: 'openai-key',
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'fallback-model'
    },
    proAgent: {
      run: async (payload) => {
        proPayloads.push(payload);
        return {
          ok: true,
          text: '{"answers":[{"question":"Q","bullets":["A","B","C"]}]}',
          cards: [{ type: 'answer', title: 'Answer', question: 'Q', bullets: ['A', 'B', 'C'] }],
          toolCalls: 0
        };
      }
    },
    intervalMs: 0
  });

  await assistant.addTranscript({
    speaker: 'System Audio',
    text: 'Are the operating model when you joined and what did you change there?',
    itemId: 'malformed-lead'
  });

  await waitFor(() => proPayloads.length === 1, 1000);
  assert.equal(
    proPayloads[0].targetQuestion,
    'What was the operating model when you joined and what did you change there?'
  );
});

test('pro partial gate accepts arbitrary complete no-punctuation interviewer questions', async () => {
  const proPayloads = [];

  const assistant = createMeetingAssistant({
    settings: {
      userTier: 'pro',
      proAgentEnabled: true,
      transcriptionApiKey: 'openai-key',
      llmApiKey: 'openai-key',
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'fallback-model'
    },
    proAgent: {
      run: async (payload) => {
        proPayloads.push(payload);
        return {
          ok: true,
          text: '{"answers":[{"question":"Q","bullets":["A","B","C"]}]}',
          cards: [{ type: 'answer', title: 'Answer', question: 'Q', bullets: ['A', 'B', 'C'] }],
          toolCalls: 0
        };
      }
    },
    intervalMs: 0
  });

  await assistant.addPartialTranscript({
    speaker: 'System Audio',
    text: 'How do you handle escalations when several enterprise customers are blocked',
    partial: true,
    itemId: 'generic-question-1'
  });

  await waitFor(() => proPayloads.length === 1, 1500);
  assert.equal(
    proPayloads[0].targetQuestion,
    'How do you handle escalations when several enterprise customers are blocked'
  );
});

test('keeps settled interviewer questions separate when a new question starts quickly', async () => {
  const meetingAssistantPath = require.resolve('../src/meetingAssistant');
  const pineconeClientPath = require.resolve('../src/pineconeClient');
  const originalMeetingAssistantCache = require.cache[meetingAssistantPath];
  const originalPineconeClientCache = require.cache[pineconeClientPath];

  try {
    delete require.cache[meetingAssistantPath];
    require.cache[pineconeClientPath] = {
      id: pineconeClientPath,
      filename: pineconeClientPath,
      loaded: true,
      exports: {
        detectResumeQuestion: async (transcript) => {
          if (transcript.includes('particular role.')) {
            return 'Why do you think you would be a good fit for this particular role.';
          }

          if (transcript.includes('sixty ninety day plan look like?')) {
            return 'If you were to get the job, what would your 30 sixty ninety day plan look like?';
          }

          return null;
        },
        searchResumeVectors: async () => [],
        extractLikelyInterviewQuestion: realExtractLikelyInterviewQuestion
      }
    };

    const { createMeetingAssistant: createAssistantWithFakeIntent } = require('../src/meetingAssistant');
    const requests = [];
    const assistant = createAssistantWithFakeIntent({
      settings: {
        llmProvider: 'local',
        localLlmUrl: 'http://localhost:1234/v1/chat/completions',
        llmModel: 'gemma-4-e4b'
      },
      axiosClient: {
        post: async (url, data) => {
          requests.push({ url, data });
          return {
            data: {
              choices: [{
                message: { content: '{"answers": [{"question":"Answer", "bullets": ["A"]}]}' }
              }]
            }
          };
        }
      },
      intervalMs: 0,
      utteranceSettleMs: 50
    });

    await assistant.addTranscript({
      speaker: 'System Audio',
      text: 'If you were to get the job, what would your 30 sixty ninety day plan look like?'
    });
    await assistant.addTranscript({
      speaker: 'System Audio',
      text: 'Why do you think you would be a good fit for this particular'
    });
    await assistant.addTranscript({
      speaker: 'System Audio',
      text: 'particular role.'
    });

    await waitFor(() => requests.length === 2, 1000);

    const targetPrompts = requests.map((request) => request.data.messages[0].content);
    assert.match(targetPrompts[0], /30 sixty ninety day plan look like\?/);
    assert.doesNotMatch(targetPrompts[0], /good fit/);
    assert.match(targetPrompts[1], /good fit for this particular role\./);
    assert.doesNotMatch(targetPrompts[1], /30 sixty ninety day plan/s);
  } finally {
    delete require.cache[meetingAssistantPath];

    if (originalMeetingAssistantCache) {
      require.cache[meetingAssistantPath] = originalMeetingAssistantCache;
    }

    if (originalPineconeClientCache) {
      require.cache[pineconeClientPath] = originalPineconeClientCache;
    } else {
      delete require.cache[pineconeClientPath];
    }
  }
});

test('manual Ask Clyde request includes prompt and screenshot in assistant call', async () => {
  const requests = [];
  const updates = [];

  const assistant = createMeetingAssistant({
    settings: {
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'vision-model'
    },
    axiosClient: {
      post: async (url, data) => {
        requests.push({ url, data });
        return {
          data: {
            choices: [{
              message: { content: '{"suggestions": [{"text":"Mention the pricing slide."}]}' }
            }]
          }
        };
      }
    },
    intervalMs: 1,
    sendUpdate: (update) => updates.push(update)
  });

  await assistant.addTranscript({ speaker: 'System Audio', text: 'Can you explain what is on this slide?' });
  requests.length = 0;
  updates.length = 0;

  const result = await assistant.requestSuggestion({
    prompt: 'What should I say about this slide?',
    screenshot: { mimeType: 'image/png', data: 'abc123' }
  });

  assert.equal(result.ok, true);
  assert.match(requests[0].data.messages[0].content, /Current command: manual_question/);
  assert.match(requests[0].data.messages[1].content[0].text, /User question:\nWhat should I say about this slide\?/);
  assert.equal(requests[0].data.messages[1].content[1].type, 'image_url');
  assert.equal(updates[0].cards[0].type, 'answer');
  assert.equal(updates[0].cards[0].title, 'Answer');
  assert.equal(updates[0].cards[0].body, 'Mention the pricing slide.');
});

test('say-next request keeps interview suggestion card styling', async () => {
  const requests = [];
  const updates = [];

  const assistant = createMeetingAssistant({
    settings: {
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'text-model'
    },
    axiosClient: {
      post: async (url, data) => {
        requests.push({ url, data });
        return {
          data: {
            choices: [{
              message: { content: '{"suggestions": [{"text":"Lead with the support operations example."}]}' }
            }]
          }
        };
      }
    },
    intervalMs: 1,
    sendUpdate: (update) => updates.push(update)
  });

  const result = await assistant.requestSuggestion({
    prompt: 'What should I say next?',
    intent: 'say_next'
  });

  assert.equal(result.ok, true);
  assert.match(requests[0].data.messages[0].content, /Current command: suggestion/);
  assert.equal(updates[0].cards[0].type, 'suggestion');
  assert.equal(updates[0].cards[0].title, 'Say next');
  assert.equal(updates[0].cards[0].body, 'Lead with the support operations example.');
});

test('meeting screenshot request returns screen description and answer cards', async () => {
  const requests = [];
  const updates = [];

  const assistant = createMeetingAssistant({
    settings: {
      appMode: 'meeting',
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'vision-model'
    },
    axiosClient: {
      post: async (url, data) => {
        requests.push({ url, data });
        return {
          data: {
            choices: [{
              message: { content: '{"screen_descriptions":[{"text":"A planning doc is open."}],"answers":[{"question":"What am I looking at?","bullets":["The screen shows a planning document."]}]}' }
            }]
          }
        };
      }
    },
    intervalMs: 1,
    sendUpdate: (update) => updates.push(update)
  });

  const result = await assistant.requestSuggestion({
    prompt: 'What am I looking at?',
    intent: 'screen_question',
    mode: 'meeting',
    screenshot: { mimeType: 'image/png', data: 'abc123' }
  });

  assert.equal(result.ok, true);
  assert.match(requests[0].data.messages[0].content, /Current command: meeting_screen_question/);
  assert.match(requests[0].data.messages[1].content[0].text, /Screen question:\nWhat am I looking at\?/);
  assert.match(requests[0].data.messages[1].content[0].text, /Describe the attached screen first/);
  assert.equal(requests[0].data.messages[1].content[1].type, 'image_url');
  assert.deepEqual(updates[0].cards.map((card) => card.type), ['screen_description', 'answer']);
});

test('meeting say-next request returns suggestions and insights from transcript', async () => {
  const requests = [];
  const updates = [];

  const assistant = createMeetingAssistant({
    settings: {
      appMode: 'meeting',
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'text-model'
    },
    axiosClient: {
      post: async (url, data) => {
        requests.push({ url, data });
        return {
          data: {
            choices: [{
              message: { content: '{"suggestions":[{"text":"Ask who owns the launch date.","why":"Ownership is unclear."}],"insights":[{"text":"The team is blocked on release scope."}]}' }
            }]
          }
        };
      }
    },
    intervalMs: 1,
    sendUpdate: (update) => updates.push(update)
  });

  await assistant.addTranscript({ speaker: 'You', text: 'Can we move the launch?' });
  const result = await assistant.requestSuggestion({
    prompt: 'What should I say next?',
    intent: 'say_next',
    mode: 'meeting'
  });

  assert.equal(result.ok, true);
  assert.match(requests[0].data.messages[0].content, /Current command: meeting_say_next/);
  assert.match(requests[0].data.messages[1].content, /Transcript:\nYou: Can we move the launch\?/);
  assert.deepEqual(updates[0].cards.map((card) => card.type), ['suggestion', 'insight']);
});

test('meeting custom prompt preserves prompt text and selected sources', async () => {
  const requests = [];

  const assistant = createMeetingAssistant({
    settings: {
      appMode: 'meeting',
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'text-model',
      ragEnabled: true
    },
    axiosClient: {
      post: async (url, data) => {
        requests.push({ url, data });
        return {
          data: {
            choices: [{
              message: { content: '{"answers":[{"question":"List blockers","bullets":["Scope is unclear."]}],"notes":[]}' }
            }]
          }
        };
      }
    },
    intervalMs: 1
  });

  const result = await assistant.requestSuggestion({
    prompt: 'List the blockers exactly.',
    intent: 'custom_prompt',
    mode: 'meeting',
    sources: { resume: true, memory: true, rag: true, web: true }
  });

  assert.equal(result.ok, true);
  assert.match(requests[0].data.messages[0].content, /Current command: meeting_custom_prompt/);
  assert.match(requests[0].data.messages[1].content, /Custom prompt:\nList the blockers exactly\./);
  assert.match(requests[0].data.messages[1].content, /Selected sources: memory, rag, web/);
  assert.doesNotMatch(requests[0].data.messages[1].content, /resume/);
});

test('selected source defaults and filtering are mode-aware', () => {
  assert.deepEqual(normalizeSelectedSources({}, { ragEnabled: true }, 'meeting'), ['rag']);
  assert.deepEqual(normalizeSelectedSources({}, { ragEnabled: false }, 'meeting'), ['memory']);
  assert.deepEqual(normalizeSelectedSources({}, { ragEnabled: false }, 'interview'), ['resume']);
  assert.deepEqual(
    normalizeSelectedSources({ resume: true, memory: true, web: true }, { ragEnabled: false }, 'meeting'),
    ['memory', 'web']
  );
  assert.deepEqual(
    normalizeSelectedSources({ resume: true, memory: true, web: true }, { ragEnabled: false }, 'interview'),
    ['resume', 'web']
  );
});

test('manual Ask Clyde retries without screenshot when local vision request fails', async () => {
  const requests = [];

  const assistant = createMeetingAssistant({
    settings: {
      llmProvider: 'local',
      localLlmUrl: 'http://localhost:1234/v1/chat/completions',
      llmModel: 'text-model'
    },
    axiosClient: {
      post: async (url, data) => {
        requests.push({ url, data });
        if (requests.length === 1) {
          const error = new Error('image input rejected');
          error.response = { status: 400 };
          error.config = { url };
          throw error;
        }
        return {
          data: {
            choices: [{
              message: { content: '{"suggestions": [{"text":"Answer from transcript context."}]}' }
            }]
          }
        };
      }
    },
    intervalMs: 1
  });

  const result = await assistant.requestSuggestion({
    prompt: 'What should I say?',
    screenshot: { mimeType: 'image/png', data: 'abc123' }
  });

  assert.equal(result.ok, true);
  assert.equal(requests.length, 2);
  assert.equal(Array.isArray(requests[0].data.messages[1].content), true);
  assert.equal(typeof requests[1].data.messages[1].content, 'string');
  assert.match(result.cards[0].detail, /Screenshot was unavailable/);
});

test('does not call LM Studio when only the user speaks', async () => {
  const requests = [];

  const assistant = createMeetingAssistant({
    settings: {
        llmProvider: 'local',
        localLlmUrl: 'http://localhost:1234/v1/chat/completions',
        llmModel: 'gemma-4-e4b'
    },
    axiosClient: {
      post: async (url, data) => {
        requests.push({ url, data });

        return {
          data: {
            choices: [{
              message: { content: 'test output' }
            }]
          }
        };
      }
    },
    intervalMs: 1
  });

  const result = await assistant.addTranscript({ speaker: 'You', text: 'What is 2 plus 2?' });

  assert.equal(result.skipped, 'user-speaker');
  assert.equal(requests.length, 0);
});

test('does not retrieve Pinecone context when RAG is disabled', async () => {
  const meetingAssistantPath = require.resolve('../src/meetingAssistant');
  const pineconeClientPath = require.resolve('../src/pineconeClient');
  const originalMeetingAssistantCache = require.cache[meetingAssistantPath];
  const originalPineconeClientCache = require.cache[pineconeClientPath];
  const originalPineconeApiKey = process.env.PINECONE_API_KEY;
  const originalPineconeHost = process.env.PINECONE_HOST;

  let searchCalls = 0;

  try {
    process.env.PINECONE_API_KEY = 'env-key';
    process.env.PINECONE_HOST = 'https://example-index.pinecone.io';

    delete require.cache[meetingAssistantPath];
    require.cache[pineconeClientPath] = {
      id: pineconeClientPath,
      filename: pineconeClientPath,
      loaded: true,
      exports: {
        detectResumeQuestion: async () => 'Tell me about your support career.',
        searchResumeVectors: async () => {
          searchCalls++;
          return [{ text: 'Pinecone fact' }];
        },
        extractLikelyInterviewQuestion: realExtractLikelyInterviewQuestion
      }
    };

    const { createMeetingAssistant: createAssistantWithFakePinecone } = require('../src/meetingAssistant');
    const requests = [];

    const assistant = createAssistantWithFakePinecone({
      settings: {
        llmProvider: 'local',
        localLlmUrl: 'http://localhost:1234/v1/chat/completions',
        llmModel: 'gemma-4-e4b',
        ragEnabled: false
      },
      axiosClient: {
        post: async (url, data) => {
          requests.push({ url, data });
          return {
            data: {
              choices: [{
                message: { content: '{"answers": [{"question":"Why support?", "bullets": ["Because I like solving customer problems."]}]}' }
              }]
            }
          };
        }
      },
      intervalMs: 1
    });

    await assistant.addTranscript({ speaker: 'System Audio', text: 'Can you walk me through your support career?' });

    assert.equal(searchCalls, 0);
    assert.equal(requests.length, 1);
    assert.doesNotMatch(requests[0].data.messages[0].content, /Pinecone fact/);
  } finally {
    if (originalPineconeApiKey === undefined) {
      delete process.env.PINECONE_API_KEY;
    } else {
      process.env.PINECONE_API_KEY = originalPineconeApiKey;
    }

    if (originalPineconeHost === undefined) {
      delete process.env.PINECONE_HOST;
    } else {
      process.env.PINECONE_HOST = originalPineconeHost;
    }

    delete require.cache[meetingAssistantPath];

    if (originalMeetingAssistantCache) {
      require.cache[meetingAssistantPath] = originalMeetingAssistantCache;
    }

    if (originalPineconeClientCache) {
      require.cache[pineconeClientPath] = originalPineconeClientCache;
    } else {
      delete require.cache[pineconeClientPath];
    }
  }
});

test('warns when LM Studio returns no visible assistant content', async () => {
  const statuses = [];

  const assistant = createMeetingAssistant({
    settings: {
        llmProvider: 'local',
        localLlmUrl: 'http://localhost:1234/v1/chat/completions',
        llmModel: 'gemma-4-e4b'
    },
    axiosClient: {
      post: async () => ({
        data: {
          choices: [{
            message: { content: '<think>silently pondering</think>' }
          }]
        }
      })
    },
    intervalMs: 1,
    sendStatus: (status) => statuses.push(status)
  });

  const result = await assistant.addTranscript({ speaker: 'System Audio', text: 'Can you give an example of a process you have put in place to help scale the team better?' });

  assert.equal(result.text, '');
  assert.equal(statuses[0].state, 'warning');
  assert.match(statuses[0].message, /empty assistant message/);
});

test('extracts assistant text from chat completion responses', () => {
  assert.equal(
    extractAssistantText({
      choices: [{ message: { content: 'hello' } }]
    }),
    'hello'
  );
});

test('parses structured assistant cards', () => {
  const cards = parseAssistantCards(JSON.stringify({
    answers: [{ question: 'What changed?', bullets: ['Liquidity increased.'] }],
    suggestions: [{ text: 'I would ask how this affects timing.', why: 'It moves the discussion forward.' }],
    memory_cards: [{ fact: 'Cody mentioned Lambda.', source: 'Interview_with_Cody.txt' }]
  }));

  assert.deepEqual(cards.map((card) => card.type), ['answer', 'suggestion', 'memory']);
  assert.equal(cards[0].title, 'Answer');
  assert.equal(cards[1].title, 'Say next');
  assert.equal(cards[2].agentic, true);
});

test('pro tier uses realtime agent and emits agentic memory cards', async () => {
  const updates = [];
  let proCalls = 0;

  const assistant = createMeetingAssistant({
      settings: {
        userTier: 'pro',
        proAgentEnabled: true,
        transcriptionApiKey: 'openai-key',
        llmApiKey: 'openai-key',
        llmProvider: 'local',
        localLlmUrl: 'http://localhost:1234/v1/chat/completions',
        llmModel: 'fallback-model'
      },
      testProIntent: true,
    proAgent: {
      searchMemoryCards: async (payload) => {
        assert.equal(payload.allowMemorySearch, true);
        return {
          contextText: 'Cody mentioned Lambda. (Source: Interview_with_Cody.txt)',
          cards: [{
            type: 'memory',
            title: 'Memory',
            body: 'Cody mentioned Lambda.',
            detail: 'Interview_with_Cody.txt',
            agentic: true
          }]
        };
      },
      run: async (payload) => {
        proCalls++;
        assert.equal(payload.allowMemorySearch, false);
        assert.equal(payload.toolsEnabled, false);
        return {
          ok: true,
          text: '{"answers":[{"question":"Q","bullets":["A"]}]}',
          cards: [{
            type: 'answer',
            title: 'Answer',
            question: 'Q',
            bullets: ['A']
          }],
          toolCalls: 0
        };
      }
    },
    axiosClient: {
      post: async () => {
        throw new Error('free path should not run');
      }
    },
    intervalMs: 1,
    sendUpdate: (update) => updates.push(update)
  });

  const result = await assistant.addTranscript({
    speaker: 'System Audio',
    text: 'Can you tell me about the My Career Max project?'
  });

  assert.equal(result.ok, true);
  assert.equal(proCalls, 2);
  assert.equal(updates[0].cards[0].type, 'answer');
  assert.equal(updates[1].cards[0].type, 'memory');
  assert.equal(updates[1].cards[0].agentic, true);
  assert.equal(result.cards[0].type, 'answer');
});

test('pro tier falls back to free assistant path when realtime agent fails', async () => {
  const requests = [];
  const statuses = [];

  const assistant = createMeetingAssistant({
      settings: {
        userTier: 'pro',
        proAgentEnabled: true,
        transcriptionApiKey: 'openai-key',
        llmApiKey: 'openai-key',
        llmProvider: 'local',
        localLlmUrl: 'http://localhost:1234/v1/chat/completions',
        llmModel: 'fallback-model'
      },
      testProIntent: true,
    proAgent: {
      run: async () => {
        throw new Error('socket dropped');
      }
    },
    axiosClient: {
      post: async (url, data) => {
        requests.push({ url, data });
        return {
          data: {
            choices: [{
              message: { content: '{"answers":[{"question":"Tell me about the project?","bullets":["Use the fallback answer."]}]}' }
            }]
          }
        };
      }
    },
    intervalMs: 1,
    sendStatus: (status) => statuses.push(status)
  });

  const result = await assistant.addTranscript({
    speaker: 'System Audio',
    text: 'Can you tell me about the My Career Max project?'
  });

  assert.equal(result.ok, true);
  assert.equal(requests.length, 1);
  assert.match(statuses.map((status) => status.message).join('\n'), /Pro agent unavailable/);
  assert.equal(result.cards[0].type, 'answer');
});

test('pro memory search is throttled across automatic transcript turns', async () => {
  const allowFlags = [];
  const runFlags = [];

  const assistant = createMeetingAssistant({
      settings: {
        userTier: 'pro',
        proAgentEnabled: true,
        transcriptionApiKey: 'openai-key',
        llmApiKey: 'openai-key',
        llmProvider: 'local',
        localLlmUrl: 'http://localhost:1234/v1/chat/completions',
        llmModel: 'fallback-model'
      },
    proMemorySearchIntervalMs: 15000,
    testProIntent: true,
    proAgent: {
      searchMemoryCards: async (payload) => {
        allowFlags.push(payload.allowMemorySearch);
        return { cards: [], contextText: '' };
      },
      run: async (payload) => {
        runFlags.push(payload.allowMemorySearch);
        return {
          ok: true,
          text: '{"answers":[{"question":"Q","bullets":["A"]}]}',
          cards: [{ type: 'answer', title: 'Answer', question: 'Q', bullets: ['A'] }],
          toolCalls: 0
        };
      }
    },
    axiosClient: {
      post: async () => {
        throw new Error('free path should not run');
      }
    },
    intervalMs: 1
  });

  await assistant.addTranscript({ speaker: 'System Audio', text: 'Can you tell me about the My Career Max project?' });
  await assistant.addTranscript({ speaker: 'System Audio', text: 'Can you tell me about your support career?' });

  assert.deepEqual(allowFlags, [true]);
  assert.deepEqual(runFlags, [false, false]);
});

test('detects the user speaker label', () => {
  assert.equal(isUserSpeaker('You'), true);
  assert.equal(isUserSpeaker('System Audio'), false);
});

test('formats assistant network errors', () => {
  assert.equal(
    describeAssistantError({
      code: 'ECONNREFUSED',
      config: { url: 'http://localhost:1234/v1/chat/completions' }
    }),
    'ECONNREFUSED calling http://localhost:1234/v1/chat/completions'
  );
});
