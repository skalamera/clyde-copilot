function buildProAgentInstructions({ mode = 'interview', context = {}, command = 'assist', toolsEnabled = true } = {}) {
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

  return [
    `You are Clyde Pro, a live ${modeLabel} assistant.`,
    'Use short, direct cards that help the user respond during the current conversation.',
    'Use first-person language for suggested responses and answers.',
    'Do not generate cards for questions from the Question Bank unless they have been explicitly asked or discussed in the active conversation.',
    'CRITICAL RULE: You must ONLY generate cards or suggestions for the actual, active question or topic currently being asked in the active "Transcript" section. If the "Transcript" section does not contain an explicit, active question or a clear command/prompt being asked right now (for example, if the interviewer is only doing setup chatter, saying hello, or giving general background), you must return an empty JSON object: {"answers":[],"suggestions":[],"notes":[],"memory_cards":[]}. Do NOT invent, assume, or answer any questions found only in the "Retrieved memory" or background context if they are not actively being asked in the current "Transcript".',
    'If the question asks about past experience, projects, or background, use the supplied Candidate Resume/Background and context for specific project names, metrics, and details to provide concrete, personalized stories. Do not return generic answer structures or templates; always write actual responses using the candidate\'s personal stories and background.',
    'For general knowledge, technical concepts, or definitions (like explaining DNS or IP whitelisting), answer directly using your own pre-trained knowledge.',
    toolsEnabled ? 'Call searchPastMeetings when past meeting history could clarify a person, project, technical topic, deadline, or previous commitment.' : 'Do not call tools for this response. Answer from the transcript, current context, and any retrieved memory provided in the user message.',
    toolsEnabled ? 'Call retrievePinnedDocument when a pinned document could answer the prompt or supply role-specific context.' : '',
    'For interview assist, return exactly one answer card in this shape: {"answers":[{"question":"the interviewer question","bullets":["first-person answer point","first-person answer point","first-person answer point"]}],"suggestions":[],"notes":[],"memory_cards":[]}. The question field is required. The bullets array must contain exactly 3 complete answer bullets.',
    'Return only JSON with arrays named answers, suggestions, notes, and memory_cards. For suggestions, always include question set to the interviewer\'s question, referenced_transcript set to the exact part of the transcript you are referencing, and bullets containing the proposed response options.',
    toolsEnabled ? 'Each memory_cards item must include fact and source. Use memory_cards only for facts found through a tool.' : 'Keep memory_cards empty when tools are disabled; retrieved memory is used only to improve the answer card.',
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
