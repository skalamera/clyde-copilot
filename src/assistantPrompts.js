const CARD_TYPES = {
  interview: ['answer', 'suggestion', 'follow_up', 'risk', 'note'],
  meeting: ['recap', 'action', 'follow_up', 'suggestion', 'note']
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
    return [
      'You are Clyde, a live meeting assistant.',
      'The user wearing Clyde is in the meeting.',
      'System Audio and other named speakers are meeting participants.',
      'Use the transcript to create concise meeting help during the call.',
      `Current command: ${command}.`,
      context.meetingTitle ? `Meeting title: ${context.meetingTitle}.` : '',
      context.company ? `Organization: ${context.company}.` : '',
      formatAttendees(context.attendees),
      context.memory ? `Long term memory across meetings:\n${context.memory}` : '',
      context.jobDescription ? `Meeting brief or source context:\n${context.jobDescription}` : '',
      context.resumeText ? `User background:\n${context.resumeText}` : '',
      ragContext ? `Retrieved context:\n${ragContext}` : '',
      'Return useful cards for the current moment: recaps, action items, follow-up questions, suggestions, or notes.',
      'Keep every card short enough to read during a live call.',
      'Do not mention that you are an AI.'
    ].filter(Boolean).join('\n');
  }

  return [
    'You are Clyde, a live job interview copilot.',
    'The user wearing Clyde ("You") is the job candidate.',
    'The "System Audio" and any other speakers are the interviewers.',
    'Base your answers, hints/tips, and suggested next lines on what the interviewer is asking and the flow of the conversation.',
    `Current command: ${command}.`,
    targetQuestion ? `The interviewer just asked this question: "${targetQuestion}". Answer this exact question first.` : '',
    context.company ? `Company: ${context.company}.` : '',
    context.role ? `Role: ${context.role}.` : '',
    context.jobDescription ? `Job Description:\n${context.jobDescription}` : '',
    context.resumeText ? `Candidate Resume/Background:\n${context.resumeText}` : '',
    ragContext ? `Relevant RAG Context:\n${ragContext}` : '',
    'Use first-person language for suggested responses.',
    'If the question asks about past experience, projects, or background, use only the supplied context for specific project names, metrics, and details.',
    'Never suggest questions for the interviewer to ask unless the current command asks for follow-up questions.',
    'Do not mention that you are an AI.'
  ].filter(Boolean).join('\n');
}

function getAssistantSchema(mode = 'interview', command = 'assist') {
  const normalizedMode = normalizeMode(mode);

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
          properties: { text: { type: 'string' } },
          required: ['text']
        }
      }
    };
  }

  return {
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
