function transcriptToText(transcript = []) {
  return transcript.map((turn) => `${turn.speaker}: ${turn.text}`).join('\n');
}

function buildTranscriptCleanupPrompt(transcript = []) {
  return `You are cleaning an interview transcript for later grading.
Keep every substantive question and answer.
Merge broken fragments from the same thought when the transcript split them across turns.
Remove filler words, repeated fragments, accidental partial sentences, and out-of-place phrases.
Do not summarize, shorten the interview, invent details, or replace answers with generic placeholders.
Preserve speaker labels and preserve numbers, tools, company names, project names, and outcomes.
Return the cleaned transcript as structured JSON.

Transcript:
${transcriptToText(transcript)}`;
}

function normalizeCleanedTranscriptResponse(responseText, originalTranscript = []) {
  const parsed = parseCleanupResponse(responseText);
  if (!parsed || !Array.isArray(parsed.transcript)) {
    return null;
  }

  const cleaned = parsed.transcript
    .map((turn) => ({
      speaker: String(turn.speaker || '').trim(),
      text: String(turn.text || '').trim()
    }))
    .filter((turn) => turn.speaker && turn.text);

  if (!hasEnoughTranscriptContent(originalTranscript, cleaned)) {
    return null;
  }

  return cleaned;
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

function hasEnoughTranscriptContent(originalTranscript = [], cleanedTranscript = []) {
  if (!cleanedTranscript.length) {
    return false;
  }

  const originalLength = transcriptContentLength(originalTranscript);
  const cleanedLength = transcriptContentLength(cleanedTranscript);

  if (originalLength < 80) {
    return cleanedLength > 0;
  }

  return cleanedLength >= Math.max(60, Math.floor(originalLength * 0.45));
}

function transcriptContentLength(transcript = []) {
  return transcript.reduce((total, turn) => total + String(turn.text || '').trim().length, 0);
}

module.exports = {
  buildTranscriptCleanupPrompt,
  normalizeCleanedTranscriptResponse,
  transcriptToText
};
