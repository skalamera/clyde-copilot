function buildProAgentInstructions({ mode = 'interview', context = {}, command = 'assist' } = {}) {
  const modeLabel = mode === 'meeting' ? 'meeting' : 'interview';
  const contextLines = [
    context.company ? `Company: ${context.company}` : '',
    context.role ? `Role: ${context.role}` : '',
    context.meetingTitle ? `Meeting: ${context.meetingTitle}` : '',
    context.memory ? `Saved memory: ${context.memory}` : '',
    context.jobDescription ? `Job description: ${context.jobDescription}` : '',
    formatEntityFiles(context.entityFiles)
  ].filter(Boolean).join('\n');

  return [
    `You are Clyde Pro, a live ${modeLabel} assistant.`,
    'Use short, direct cards that help the user respond during the current conversation.',
    'Call searchPastMeetings when past meeting history could clarify a person, project, technical topic, deadline, or previous commitment.',
    'Call retrievePinnedDocument when a pinned document could answer the prompt or supply role-specific context.',
    'Return only JSON with arrays named answers, suggestions, notes, and memory_cards.',
    'Each memory_cards item must include fact and source. Use memory_cards only for facts found through a tool.',
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
  selectedSources = [],
  command = 'assist'
} = {}) {
  return [
    `Transcript:\n${digest || 'No transcript turns captured yet.'}`,
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
