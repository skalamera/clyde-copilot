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
      'The user wearing Clyde is in the meeting.',
      'System Audio and other named speakers are meeting participants.',
      'Use the transcript to create concise meeting help during the call.',
      `Current command: ${command}.`,
      commandGuidance,
      context.meetingTitle ? `Meeting title: ${context.meetingTitle}.` : '',
      context.company ? `Organization: ${context.company}.` : '',
      formatAttendees(context.attendees),
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
    'The user wearing Clyde ("You") is the job candidate.',
    'The "System Audio" and any other speakers are the interviewers.',
    'Base your answers, hints/tips, and suggested next lines on what the interviewer is asking and the flow of the conversation.',
    `Current command: ${command}.`,
    targetQuestion ? `The interviewer just asked this question: "${targetQuestion}". Answer this exact question first.` : '',
    context.company ? `Company: ${context.company}.` : '',
    context.role ? `Role: ${context.role}.` : '',
    context.jobDescription ? `Job Description:\n${context.jobDescription}` : '',
    context.resumeText ? `Candidate Resume/Background:\n${context.resumeText}` : '',
    context.pinnedKnowledgeBrief ? `Pinned Knowledge Brief:\n${context.pinnedKnowledgeBrief}` : '',
    formatEntityFiles(context.entityFiles),
    ragContext ? `Relevant RAG Context:\n${ragContext}` : '',
    'Use first-person language for suggested responses.',
    'If the question asks about past experience, projects, or background, use only the supplied context for specific project names, metrics, and details.',
    'Never suggest questions for the interviewer to ask unless the current command asks for follow-up questions.',
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
