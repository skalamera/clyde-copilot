const { transcriptToText } = require('./transcriptCleanup');

function buildQuestionBankExtractionPrompt(record = {}, jobDescription = '') {
  const company = clean(record.entity?.name || record.entity?.id);
  const role = clean(record.entity?.role);
  return `Extract every interviewer question from this interview transcript and create a Question Bank entry for each one.

For each question:
- Include the interviewer question.
- Skip small talk, greetings, introductions without evaluation content, setup checks, audio/video checks, visibility checks, connection checks, scheduling/logistics, availability checks, and transcript artifacts. Examples to skip: "Can you hear me?", "Can you see me?", "Are you there?", "Is now still a good time?", "Does tomorrow still work?".
- If the candidate answered correctly and clearly, summarize that answer.
- If the answer was weak, incomplete, incorrect, missing, or joking, write a strong sample answer using the resume, job description, and transcript context.
- Never skip a question because the candidate answer was poor. Generate a better sample answer.
- Return JSON only.

Required JSON:
{
  "entries": [
    {
      "question": "Question asked by interviewer",
      "sampleAnswer": "Correct sample answer",
      "answerSource": "candidate or clyde_generated",
      "tags": ["theme"]
    }
  ]
}

Company: ${company || 'Unknown'}
Role: ${role || 'Unknown'}
Job description:
${jobDescription || 'No job description saved.'}

Transcript:
${transcriptToText(record.transcript || [])}`;
}

function normalizeQuestionBankExtractionResponse(responseText) {
  const parsed = parseJson(responseText);
  const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
  return entries
    .map((entry) => ({
      question: clean(entry?.question),
      sampleAnswer: clean(entry?.sampleAnswer || entry?.sample_answer || entry?.answer),
      answerSource: clean(entry?.answerSource || entry?.answer_source) === 'candidate' ? 'candidate' : 'clyde_generated',
      tags: Array.isArray(entry?.tags) ? entry.tags.map(clean).filter(Boolean).slice(0, 8) : []
    }))
    .filter((entry) => entry.question && entry.sampleAnswer && isQuestionBankWorthyQuestion(entry.question));
}

function isQuestionBankWorthyQuestion(question) {
  const normalized = clean(question)
    .toLowerCase()
    .replace(/[^a-z0-9\s?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return false;
  }

  const blockedPatterns = [
    /^(can|could|do) you (hear|see|understand) me\??$/,
    /^are you (there|with me|able to hear me|still there|on)\??$/,
    /^can everyone (hear|see) me\??$/,
    /^is (my|your|the) (audio|video|camera|microphone|mic|screen) (working|okay|ok|on|visible)\??$/,
    /^(can|could) you turn (on|off) your (camera|video|mic|microphone)\??$/,
    /^(can|could) you join (the )?(call|meeting|zoom|meet)\??$/,
    /^is now (still )?(a )?good time\??$/,
    /^(does|do|will) (today|tomorrow|this time|that time|[a-z]+day) (still )?(work|works)\??$/,
    /^(are|were) you able to (join|make it)\??$/,
    /^do you have (a few|some) minutes\??$/,
    /^(hello|hi|hey|good morning|good afternoon|good evening)\??$/,
    /^how are you( doing)?\??$/,
    /^how'?s it going\??$/,
    /^nice to (meet|see) you.*\??$/,
    /^thanks? for (joining|meeting|your time).*\??$/,
    /^can you repeat that\??$/,
    /^does that make sense\??$/,
    /^should we get started\??$/,
    /^shall we get started\??$/
  ];

  return !blockedPatterns.some((pattern) => pattern.test(normalized));
}

function questionBankExtractionSchema() {
  return {
    name: 'question_bank_extraction',
    schema: {
      type: 'object',
      properties: {
        entries: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              sampleAnswer: { type: 'string' },
              answerSource: { type: 'string', enum: ['candidate', 'clyde_generated'] },
              tags: {
                type: 'array',
                items: { type: 'string' }
              }
            },
            required: ['question', 'sampleAnswer', 'answerSource', 'tags'],
            additionalProperties: false
          }
        }
      },
      required: ['entries'],
      additionalProperties: false
    }
  };
}

function parseJson(text) {
  try {
    return JSON.parse(String(text || '').trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim());
  } catch (_error) {
    return null;
  }
}

function clean(value) {
  return String(value || '').trim();
}

module.exports = {
  buildQuestionBankExtractionPrompt,
  isQuestionBankWorthyQuestion,
  normalizeQuestionBankExtractionResponse,
  questionBankExtractionSchema
};
