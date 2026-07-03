const CARD_TYPES = {
  interview: ['answer', 'suggestion', 'follow_up', 'risk', 'note'],
  meeting: ['recap', 'action', 'follow_up', 'suggestion', 'insight', 'screen_description', 'note']
};

function getAllowedCardTypes(mode = 'interview') {
  return CARD_TYPES[normalizeMode(mode)];
}

function normalizeMode(mode) {
  return mode === 'meeting' ? 'meeting' : 'interview';
}

function buildAssistantPrompt(options = {}) {
  const mode = normalizeMode(options.mode);
  const context = options.context || {};
  const command = options.command || 'assist';
  const targetQuestion = options.targetQuestion || '';
  const ragContext = options.ragContext || '';

  if (mode === 'meeting') {
    const commandGuidance = meetingCommandGuidance(command);
    return [
      'You are Clyde, a live meeting assistant.',
      `Current Date & Time: ${new Date().toString()}`,
      'The user wearing Clyde is in the meeting.',
      'System Audio and other named speakers are meeting participants.',
      'Use the transcript to create concise meeting help during the call.',
      `Current command: ${command}.`,
      commandGuidance,
      context.meetingTitle ? `Meeting title: ${context.meetingTitle}.` : '',
      context.company ? `Organization: ${context.company}.` : '',
      formatAttendees(context.attendees),
      context.soul ? `Clyde's Soul & Personality Profile:\n${context.soul}` : '',
      context.memory ? `Long term memory across meetings:\n${context.memory}` : '',
      context.pinnedKnowledgeBrief ? `Pinned knowledge brief:\n${context.pinnedKnowledgeBrief}` : '',
      context.jobDescription ? `Meeting brief or source context:\n${context.jobDescription}` : '',
      context.resumeText ? `User background:\n${context.resumeText}` : '',
      formatEntityFiles(context.entityFiles),
      ragContext ? `Retrieved context:\n${ragContext}` : '',
      'Return useful cards for the current moment: recaps, action items, follow-up questions, suggestions, or notes.',
      'Keep every card short enough to read during a live call.',
      'Do not mention that you are an AI.'
    ].filter(Boolean).join('\n');
  }

  return [
    'You are Clyde, a live job interview copilot.',
    `Current Date & Time: ${new Date().toString()}`,
    'The user wearing Clyde ("You") is the job candidate.',
    'The "System Audio" and any other speakers are the interviewers.',
    'Base your answers, hints/tips, and suggested next lines on what the interviewer is asking and the flow of the conversation.',
    `Current command: ${command}.`,
    targetQuestion ? (
      isStarQuestion(targetQuestion)
        ? `The interviewer just asked this behavioral question: "${targetQuestion}". Because this is a behavioral/situational question, you MUST structure your response strictly using the STAR method. Format your exactly 4 bullets as follows:
* **[S]** (Situation context — Set the scene with a concrete challenge, scale, and specific platform/company context)
* **[T]** (Task or goal — Define the exact objective or expectation you had to achieve)
* **[A]** (Actions you took — State the exact, specific actions you took using platforms/tools with strong active verbs)
* **[R]** (Quantifiable metrics/result — Deliver the measurable business outcome, bolding all metrics)
Do not use standard bullets. Bold key metrics and outcomes.`
        : `The interviewer just asked this question: "${targetQuestion}". Answer this exact question first.`
    ) : '',
    context.company ? `Company: ${context.company}.` : '',
    context.role ? `Role: ${context.role}.` : '',
    context.soul ? `Clyde's Soul & Personality Profile:\n${context.soul}` : '',
    context.jobDescription ? `Job Description:\n${context.jobDescription}` : '',
    context.resumeText ? `Candidate Resume/Background:\n${context.resumeText}` : '',
    context.questionBankContext ? `Question Bank:\n${context.questionBankContext}` : '',
    context.pinnedKnowledgeBrief ? `Pinned Knowledge Brief:\n${context.pinnedKnowledgeBrief}` : '',
    formatEntityFiles(context.entityFiles),
    ragContext ? `Relevant RAG Context:\n${ragContext}` : '',
    command === 'interviewer_questions' ? 'Generate 3 thoughtful questions the candidate can ask the interviewer at the end of the interview. Return one answer card with question set to "Questions to ask the interviewer" and the questions as bullets.' : '',
    command === 'screen_question' ? 'A desktop screenshot is attached. Analyze the attached screenshot of the user\'s own screen along with the recent transcript turns, and provide a single answer card summarizing your analysis and suggestions.' : '',
    'When a screenshot is provided, it is a capture of the user\'s own screen. Do not assume the interviewer is looking at it or has access to it, and describe the screen contents directly to the user.',
    'Use first-person language for suggested responses.',
    'Keep every bullet point concise, punchy, and easy to scan in 2 seconds. Each bullet point should be around 15-25 words to ensure it contains high-quality, substantive, and highly specific details, without any generic fluff.',
    'For behavioral/situational questions (e.g., "Tell me about a time...", "Give an example of...", "Describe a situation...", "How did you handle..."), you must ALWAYS use the STAR format with exactly 4 bullets, prefixed as follows:',
    '  - Bullet 1: **[S]** (Situation) — Set the scene with a concrete challenge, scale, and specific platform/company context.',
    '  - Bullet 2: **[T]** (Task) — Define the exact objective, goal, or expectation you had to achieve.',
    '  - Bullet 3: **[A]** (Action) — State the exact, specific actions you took (using platforms like Zendesk, Jira, APIs, SQL, etc.). Use strong, first-person active verbs.',
    '  - Bullet 4: **[R]** (Result) — Deliver the measurable business outcome, bolding all metrics, percentages, and dollar amounts (e.g., **98.2% SLA adherence**, **32% handle time reduction**).',
    'Do not merge or omit any of the STAR components. Provide all 4 bullets strictly in order.',
    'Make every bullet highly readable during a live call by bolding key metrics, numbers, and core impact values to allow instant split-second scanning.',
    'CRITICAL CONVERSATIONAL TONE RULES (Banish all AI-speak):',
    '- Tone must be natural, conversational, and peer-to-peer. Do not sound corporate, robotic, or like a formal teleprompter.',
    '- Use contractions naturally: I\'m, don\'t, can\'t, it\'s, we\'re, you\'re. Do not use overly formal/uncontracted phrasing.',
    '- Vary sentence rhythm and lengths. Fragments are allowed and encouraged when they sound human.',
    '- HARD BAN on corporate/AI filler words: delve, realm, leverage, empower, optimize, streamline, robust, scalable, seamless, revolutionize, cutting-edge, paradigm, showcase, meticulously, synergy, data-driven, pivotal, proactive, holistic, transformative, elevate, or adaptive.',
    '- HARD BAN on bloated verb phrase shapes: never write "serves as", "stands as", "represents a", "features a", "aims to", or "seeks to" — use simple, active verbs instead (is, has, uses, got, did, built, made, ran).',
    '- Be highly specific and concrete. Use exact numbers, platform names (Zendesk, Freshdesk, RingCentral), and real examples rather than vague high-level generalities.',
    'If the question asks about past experience, projects, or background, use only the supplied context for specific project names, metrics, and details. Otherwise, for general knowledge, technical concepts, or definitions (like explaining DNS or IP whitelisting), answer directly using your own pre-trained knowledge.',
    'Never suggest questions for the interviewer to ask unless the current command asks for follow-up questions.',
    'When generating suggestions, always set referenced_transcript to the exact portion of the transcript you are referencing, and put your proposed response options in the bullets array.',
    'Do not mention that you are an AI.'
  ].filter(Boolean).join('\n');
}

function formatEntityFiles(files = []) {
  const rows = Array.isArray(files) ? files : [];
  if (!rows.length) {
    return '';
  }
  return [
    'Files pinned to the active opportunity or meeting:',
    ...rows.slice(0, 5).map((item) => {
      const label = item.filename || item.id || 'Pinned file';
      const content = String(item.content || '').slice(0, 4000);
      return `${label}:\n${content}`;
    })
  ].join('\n\n');
}

function getAssistantSchema(mode = 'interview', command = 'assist') {
  const normalizedMode = normalizeMode(mode);

  if (normalizedMode === 'meeting' && command === 'meeting_screen_question') {
    return {
      screen_descriptions: {
        type: 'array',
        items: {
          type: 'object',
          properties: { text: { type: 'string' } },
          required: ['text']
        }
      },
      answers: answerArraySchema()
    };
  }

  if (normalizedMode === 'meeting' && command === 'meeting_say_next') {
    return {
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            why: { type: 'string' }
          },
          required: ['text']
        }
      },
      insights: {
        type: 'array',
        items: {
          type: 'object',
          properties: { text: { type: 'string' } },
          required: ['text']
        }
      }
    };
  }

  if (normalizedMode === 'meeting' && command === 'meeting_custom_prompt') {
    return {
      answers: answerArraySchema(),
      notes: {
        type: 'array',
        items: {
          type: 'object',
          properties: { text: { type: 'string' } },
          required: ['text']
        }
      }
    };
  }

  if (command === 'manual_question') {
    return {
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            why: { type: 'string' }
          },
          required: ['text']
        }
      },
      notes: {
        type: 'array',
        items: {
          type: 'object',
          properties: { text: { type: 'string' } },
          required: ['text']
        }
      }
    };
  }

  if (command === 'interviewer_questions' || command === 'screen_question') {
    return {
      answers: answerArraySchema()
    };
  }

  if (normalizedMode === 'meeting') {
    return {
      recaps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' }
          },
          required: ['text']
        }
      },
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' }
          },
          required: ['text']
        }
      },
      follow_up: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            why: { type: 'string' }
          },
          required: ['text']
        }
      },
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' }
          },
          required: ['text']
        }
      },
      notes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' }
          },
          required: ['text']
        }
      }
    };
  }

  if (command === 'suggestion') {
    return {
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            referenced_transcript: { type: 'string' },
            bullets: { type: 'array', items: { type: 'string' } }
          },
          required: ['referenced_transcript', 'bullets']
        }
      }
    };
  }


  return {
    answers: answerArraySchema()
  };
}

function answerArraySchema() {
  return {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        question: { type: 'string' },
        bullets: { type: 'array', items: { type: 'string' } }
      },
      required: ['question', 'bullets']
    }
  };
}

function meetingCommandGuidance(command) {
  if (command === 'meeting_screen_question') {
    return 'For this request, describe what is visible on the user\'s screen, then answer or comment on the user\'s screen question.';
  }

  if (command === 'meeting_say_next') {
    return 'For this request, suggest useful things the user can say next and extract insights from the transcript so far.';
  }

  if (command === 'meeting_custom_prompt') {
    return 'For this request, follow the user\'s custom prompt directly and use only the selected source names supplied in the user message.';
  }

  return '';
}

function isStarQuestion(question) {
  const normalized = String(question || '').trim().toLowerCase();
  return [
    /\b(tell me|talk me|walk me|describe|explain|share|give)\b.*\b(time|example|situation|scenario|conflict|conflicted|navigated|navigating|handled|handling|action)\b/i,
    /\b(describe a|describe an|give (an )?example|share (an )?example|have you (ever )?had|have you encountered)\b/i,
    /\b(how did you|how did you handle|how did you resolve|how did you navigate|how did you manage)\b/i,
    /\b(time you had to|time when you|example of a time|example of how you)\b/i,
    /\b(tell me about a time|tell me about your most)\b/i
  ].some(pattern => pattern.test(normalized));
}

function formatAttendees(attendees) {
  if (!Array.isArray(attendees) || attendees.length === 0) {
    return '';
  }

  const lines = attendees
    .map((attendee) => {
      const name = clean(attendee.name);
      const role = clean(attendee.role);
      return name ? `- ${name}${role ? ` (${role})` : ''}` : '';
    })
    .filter(Boolean);

  return lines.length ? `Attendees:\n${lines.join('\n')}` : '';
}

function clean(value) {
  return String(value || '').trim();
}

module.exports = {
  buildAssistantPrompt,
  getAllowedCardTypes,
  getAssistantSchema,
  normalizeMode
};
