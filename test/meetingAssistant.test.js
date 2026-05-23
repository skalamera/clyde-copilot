const assert = require('node:assert/strict');
const test = require('node:test');

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
  assert.equal(requests[0].data.max_tokens, 800);
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
        searchResumeVectors: async () => []
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
        searchResumeVectors: async () => []
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
        searchResumeVectors: async () => []
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
        }
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
