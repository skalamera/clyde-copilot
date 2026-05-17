const { normalizeCleanedTranscriptResponse, transcriptToText } = require('./transcriptCleanup');

function buildMeetingPostProcessPrompt(transcript = [], attendees = []) {
  const attendeeText = Array.isArray(attendees) && attendees.length
    ? attendees
      .map((attendee) => {
        const name = String(attendee?.name || '').trim();
        const role = String(attendee?.role || '').trim();
        if (!name) {
          return null;
        }
        return role ? `- ${name} (${role})` : `- ${name}`;
      })
      .filter(Boolean)
      .join('\n')
    : '- No attendee list provided';

  return `You are cleaning and organizing a meeting transcript for a saved meeting record.
Clean the transcript so it reads like a normal meeting transcript. Merge broken fragments from the same thought, remove filler words, remove accidental partial sentences, and preserve speaker labels, names, numbers, and decisions.
Write detailed meeting notes from the transcript. Include decisions, key points, highlights, blockers, and important follow-up context.
Extract action items from the transcript and organize them by attendee. Use attendee names from the transcript or attendee list when possible. If ownership is unclear, use "Unassigned".
Return structured JSON only.

Required JSON shape:
{
  "transcript": [
    { "speaker": "Speaker name", "text": "Cleaned transcript text." }
  ],
  "notes": {
    "summary": "Detailed meeting notes with markdown sections using **Meeting summary:**, **Key points:**, **Highlights:**, and **Important notes:**.",
    "actionItems": [
      { "attendee": "Attendee name", "items": ["Action item one", "Action item two"] }
    ]
  }
}

Attendee list:
${attendeeText}

Transcript:
${transcriptToText(transcript)}`;
}

function normalizeMeetingPostProcessResponse(responseText, originalTranscript = []) {
  const parsed = parseCleanupResponse(responseText);
  if (!parsed || !Array.isArray(parsed.transcript) || !parsed.notes || typeof parsed.notes !== 'object') {
    return null;
  }

  const cleanedTranscript = normalizeCleanedTranscriptResponse(JSON.stringify({ transcript: parsed.transcript }), originalTranscript);
  if (!cleanedTranscript) {
    return null;
  }

  const summary = cleanText(parsed.notes.summary);
  const actionItems = normalizeActionItems(parsed.notes.actionItems);

  if (!summary) {
    return null;
  }

  return {
    transcript: cleanedTranscript,
    notes: {
      summary,
      actionItems
    }
  };
}

function normalizeActionItems(actionItems = []) {
  if (!Array.isArray(actionItems)) {
    return [];
  }

  return actionItems
    .map((item) => {
      if (!item || typeof item === 'string') {
        return null;
      }

      const attendee = cleanText(item.attendee || item.owner || item.name || '');
      const items = Array.isArray(item.items)
        ? item.items.map(cleanText).filter(Boolean)
        : [];

      if (!items.length) {
        return null;
      }

      return {
        attendee: attendee || 'Unassigned',
        items
      };
    })
    .filter(Boolean);
}

function parseCleanupResponse(responseText) {
  try {
    let cleanedText = String(responseText || '').trim();

    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json/g, '').replace(/```$/g, '').trim();
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```/g, '').replace(/```$/g, '').trim();
    }

    return JSON.parse(cleanedText);
  } catch (_error) {
    return null;
  }
}

function cleanText(value) {
  return String(value || '').trim();
}

module.exports = {
  buildMeetingPostProcessPrompt,
  normalizeMeetingPostProcessResponse
};
