function buildMeetingPreviewFallback(transcript = [], cards = []) {
  const turns = normalizeTranscriptTurns(transcript);
  const topics = extractRecentTopics(turns);
  const actionItems = extractCardItems(cards, ['action', 'follow_up']);

  return {
    status: 'fallback',
    notes: {
      agenda: topics.length ? topics : ['No generated summary yet. Clyde will save the raw transcript and generate cleaned notes after save.'],
      decisions: [],
      actionItems,
      blockers: [],
      followUps: actionItems,
      openQuestions: extractQuestions(turns)
    }
  };
}

function normalizeMeetingPreviewResponse(responseText, transcript = [], cards = []) {
  const parsed = parseJson(responseText);
  if (!parsed || typeof parsed !== 'object') {
    return buildMeetingPreviewFallback(transcript, cards);
  }

  const notes = parsed.notes && typeof parsed.notes === 'object' ? parsed.notes : parsed;
  const normalized = {
    agenda: normalizeStringList(notes.agenda || notes.topics || notes.keyTopics || notes.key_points),
    decisions: normalizeStringList(notes.decisions),
    actionItems: normalizeActionItems(notes.actionItems || notes.action_items),
    blockers: normalizeStringList(notes.blockers || notes.risks || notes.blockersRisks),
    followUps: normalizeStringList(notes.followUps || notes.follow_ups),
    openQuestions: normalizeStringList(notes.openQuestions || notes.open_questions)
  };

  if (!Object.values(normalized).some((items) => items.length)) {
    return buildMeetingPreviewFallback(transcript, cards);
  }

  return {
    status: 'generated',
    notes: normalized
  };
}

function buildMeetingPreviewPrompt(transcript = [], attendees = []) {
  const attendeeText = Array.isArray(attendees) && attendees.length
    ? attendees.map((attendee) => {
      const name = clean(attendee?.name);
      const role = clean(attendee?.role);
      return role ? `${name} (${role})` : name;
    }).filter(Boolean).join(', ')
    : 'No attendee list provided';

  return `Create a pre-save meeting review from this raw transcript. Do not clean or rewrite the transcript. Return JSON only.

Required JSON:
{
  "notes": {
    "agenda": ["topic or agenda item"],
    "decisions": ["decision"],
    "actionItems": ["owner: action item"],
    "blockers": ["blocker or risk"],
    "followUps": ["follow-up"],
    "openQuestions": ["open question"]
  }
}

Attendees: ${attendeeText}

Raw transcript:
${transcriptToText(transcript)}`;
}

function normalizeTranscriptTurns(transcript = []) {
  return Array.isArray(transcript)
    ? transcript.map((turn) => ({
      speaker: clean(turn?.speaker) || 'Unknown',
      text: clean(turn?.text)
    })).filter((turn) => turn.text)
    : [];
}

function transcriptToText(transcript = []) {
  return normalizeTranscriptTurns(transcript)
    .map((turn) => `${turn.speaker}: ${turn.text}`)
    .join('\n');
}

function extractRecentTopics(turns = []) {
  return turns
    .slice(-8)
    .map((turn) => turn.text.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((text) => (text.length > 160 ? `${text.slice(0, 157)}...` : text))
    .slice(0, 5);
}

function extractQuestions(turns = []) {
  return turns
    .map((turn) => turn.text)
    .filter((text) => /\?$/.test(text.trim()))
    .slice(-5);
}

function extractCardItems(cards = [], types = []) {
  return Array.isArray(cards)
    ? cards
      .filter((card) => types.includes(card?.type))
      .flatMap((card) => [
        clean(card?.body || card?.question),
        ...(Array.isArray(card?.bullets) ? card.bullets.map(clean) : [])
      ])
      .filter(Boolean)
      .slice(0, 8)
    : [];
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) {
    return clean(value) ? [clean(value)] : [];
  }
  return value.map((item) => {
    if (typeof item === 'string') {
      return clean(item);
    }
    return clean(item?.text || item?.body || item?.title || item?.question);
  }).filter(Boolean);
}

function normalizeActionItems(value) {
  if (!Array.isArray(value)) {
    return normalizeStringList(value);
  }
  return value.flatMap((item) => {
    if (typeof item === 'string') {
      return clean(item) ? [clean(item)] : [];
    }
    const owner = clean(item?.attendee || item?.owner || item?.name);
    const items = Array.isArray(item?.items)
      ? item.items.map(clean).filter(Boolean)
      : [clean(item?.text || item?.body || item?.action)].filter(Boolean);
    return items.map((text) => (owner && owner !== 'Unassigned' ? `${owner}: ${text}` : text));
  }).filter(Boolean);
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
  buildMeetingPreviewFallback,
  buildMeetingPreviewPrompt,
  normalizeMeetingPreviewResponse,
  normalizeTranscriptTurns,
  transcriptToText
};
