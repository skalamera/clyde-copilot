function buildProAgentInstructions({ mode = 'interview', context = {}, command = 'assist', toolsEnabled = true, isAudioModality = false } = {}) {
  const modeLabel = mode === 'meeting' ? 'meeting' : 'interview';
  const contextLines = [
    context.company ? `Company: ${context.company}` : '',
    context.role ? `Role: ${context.role}` : '',
    context.meetingTitle ? `Meeting: ${context.meetingTitle}` : '',
    context.memory ? `Saved memory: ${context.memory}` : '',
    context.jobDescription ? `Job description: ${context.jobDescription}` : '',
    context.resumeText ? `Candidate Resume/Background:\n${context.resumeText}` : '',
    context.questionBankContext ? `Question Bank:\n${context.questionBankContext}` : '',
    context.pinnedKnowledgeBrief ? `Pinned knowledge brief:\n${context.pinnedKnowledgeBrief}` : '',
    formatEntityFiles(context.entityFiles)
  ].filter(Boolean).join('\n');

  const outputFormatInstruction = isAudioModality
    ? 'CRITICAL FORMAT RULE: You are outputting spoken response (AUDIO modality). Do NOT output JSON code blocks or JSON syntax. Instead, speak your response clearly as a bulleted list using standard markdown dashes (-) or asterisks (*). Provide exactly 3 or 4 clear, first-person bullet points summarizing your answer. For example:\n- Bullet 1\n- Bullet 2\n- Bullet 3'
    : 'Return only JSON with arrays named answers, suggestions, notes, and memory_cards. For suggestions, always include question set to the interviewer\'s question, referenced_transcript set to the exact part of the transcript you are referencing, and bullets containing the proposed response options.';

  return [
    `You are Clyde Pro, a live ${modeLabel} assistant.`,
    'Use short, direct cards that help the user respond during the current conversation.',
    'Use first-person language for suggested responses and answers.',
    'Do not generate cards for questions from the Question Bank unless they have been explicitly asked or discussed in the active conversation.',
    'CRITICAL RULE: You must generate cards or suggestions whenever the interviewer asks a question, raises a topic for discussion, or prompts you to speak (even if phrased as a statement, e.g. "Tell me about...", "Walk me through...", or if the transcription is slightly fragmented). Only return an empty response if the transcript contains absolutely no discussion topic or question (e.g. just saying hello, brief filler words like "okay", or pure setup chatter). If in doubt, err on the side of providing a helpful answer card.',
    'If the question asks about past experience, projects, or background, use the supplied Candidate Resume/Background and context for specific project names, metrics, and details to provide concrete, personalized stories. If no exact project in the candidate\'s background fits the question, you must intelligently and plausibly extrapolate or invent a realistic project, initiative, or metrics that perfectly align with their actual roles (such as Technical Support Engineering Manager at Sigma, or Lead Technical Support & Operations at Benchmark Education). Ensure the fabricated project sounds highly professional, fits Support Ops/Engineering leadership responsibilities, and uses realistic metrics/platforms. Do not return generic answer structures or templates; always write actual responses.',
    'For general knowledge, technical concepts, or definitions (like explaining DNS or IP whitelisting), answer directly using your own pre-trained knowledge.',
    toolsEnabled ? 'Call searchPastMeetings when past meeting history could clarify a person, project, technical topic, deadline, or previous commitment.' : 'Do not call tools for this response. Answer from the transcript, current context, and any retrieved memory provided in the user message.',
    toolsEnabled ? 'Call retrievePinnedDocument when a pinned document could answer the prompt or supply role-specific context.' : '',
    isAudioModality ? '' : 'For interview assist, return exactly one answer card in this shape: {"answers":[{"question":"the interviewer question","bullets":["first-person answer point","first-person answer point","first-person answer point"]}],"suggestions":[],"notes":[],"memory_cards":[]}. The question field is required. The bullets array must contain exactly 3 complete answer bullets (or exactly 4 complete bullets if it is a behavioral/situational question using the STAR format).',
    outputFormatInstruction,
    toolsEnabled ? 'Each memory_cards item must include fact and source. Use memory_cards only for facts found through a tool.' : 'Keep memory_cards empty when tools are disabled; retrieved memory is used only to improve the answer card.',

    // --- Tone & Style Rules ---
    'Keep every bullet point punchy, comprehensive, and rich in context. Each bullet point should be around 25-40 words to ensure it contains complete situational context, detailed action steps, platform names, and exact metrics, without any generic fluff or filler.',
    'For behavioral/situational questions (e.g., "Tell me about a time...", "Give an example of...", "Describe a situation...", "How did you handle..."), you must ALWAYS use the STAR format with exactly 4 bullets, prefixed as follows:',
    '  - Bullet 1: **[S]** (Situation) — Set the scene with a concrete challenge, scale, and specific platform/company context.',
    '  - Bullet 2: **[T]** (Task) — Define the exact objective, goal, or expectation you had to achieve.',
    '  - Bullet 3: **[A]** (Action) — State the exact, specific actions you took (using platforms like Zendesk, Jira, APIs, SQL, etc.). Use strong, first-person active verbs.',
    '  - Bullet 4: **[R]** (Result) — Deliver the measurable business outcome, bolding all metrics, percentages, and dollar amounts (e.g., **98.2% SLA adherence**, **32% handle time reduction**).',
    'Do not merge or omit any of the STAR components. Provide all 4 bullets strictly in order.',
    'Make every bullet highly readable during a live call by bolding key metrics, numbers, and core impact values for instant scanning.',
    'CRITICAL CONVERSATIONAL TONE RULES (Banish all AI-speak):',
    '- Tone must be natural, conversational, and peer-to-peer. Do not sound corporate, robotic, or like a formal teleprompter.',
    '- Use contractions naturally: I\'m, don\'t, can\'t, it\'s, we\'re, you\'re. Do not use overly formal/uncontracted phrasing.',
    '- Vary sentence rhythm and lengths. Fragments are fine when they sound human.',
    '- HARD BAN on corporate/AI filler words: delve, realm, leverage, empower, optimize, streamline, robust, scalable, seamless, revolutionize, cutting-edge, paradigm, showcase, meticulously, synergy, data-driven, pivotal, proactive, holistic, transformative, elevate, or adaptive.',
    '- HARD BAN on bloated verb phrase shapes: never write "serves as", "stands as", "represents a", "features a", "aims to", or "seeks to" — use simple active verbs instead (is, has, uses, got, did, built, made, ran).',
    '- DIVERSITY RULE: You may reference the same company more than once across different answers in the same session, but you must NEVER reuse the same specific project, situation, or story (such as the Benchmark Education ticket-tagging/Power BI redesign project) for more than one answer. Use different projects, initiatives, or challenges to demonstrate a versatile and well-rounded background.',
    '- Be highly specific and concrete. Use exact numbers, platform names (Zendesk, Freshdesk, Intercom, Salesforce, RingCentral), and real examples from the candidate\'s background rather than vague high-level generalities.',

    command ? `Current command: ${command}` : '',
    contextLines ? `Current context:\n${contextLines}` : ''
  ].filter(Boolean).join('\n\n');
}

function formatEntityFiles(files = []) {
  const rows = Array.isArray(files) ? files : [];
  if (!rows.length) {
    return '';
  }
  return [
    'Pinned entity files:',
    ...rows.slice(0, 5).map((item) => `${item.filename || item.id || 'Pinned file'}:\n${String(item.content || '').slice(0, 4000)}`)
  ].join('\n\n');
}

function buildProAgentUserMessage({
  digest = '',
  manualPrompt = '',
  memoryContext = '',
  selectedSources = [],
  command = 'assist'
} = {}) {
  return [
    `Transcript:\n${digest || 'No transcript turns captured yet.'}`,
    memoryContext ? `Retrieved memory to use if relevant:\n${memoryContext}` : '',
    manualPrompt ? `User request:\n${manualPrompt}` : '',
    selectedSources.length ? `Selected sources: ${selectedSources.join(', ')}` : '',
    `Command: ${command}`
  ].filter(Boolean).join('\n\n');
}

function getProAgentTools() {
  return [
    {
      type: 'function',
      name: 'searchPastMeetings',
      description: 'Search archived Clyde transcripts and uploaded research for relevant historical context.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'A focused search query using names, projects, technologies, or commitments from the transcript.'
          }
        },
        required: ['query'],
        additionalProperties: false
      }
    },
    {
      type: 'function',
      name: 'retrievePinnedDocument',
      description: 'Retrieve the full text of a pinned knowledge item for this session.',
      parameters: {
        type: 'object',
        properties: {
          docName: {
            type: 'string',
            description: 'The pinned document filename or title.'
          }
        },
        required: ['docName'],
        additionalProperties: false
      }
    }
  ];
}

module.exports = {
  buildProAgentInstructions,
  buildProAgentUserMessage,
  getProAgentTools
};
