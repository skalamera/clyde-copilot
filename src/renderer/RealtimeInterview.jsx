import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RealtimeInterviewService } from './realtimeInterviewService';

export function RealtimeInterview({ api, targetEntity }) {
  const [status, setStatus] = useState('disconnected');
  const [transcript, setTranscript] = useState([]);
  const [assessment, setAssessment] = useState(null);
  const [assessmentStatus, setAssessmentStatus] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [savedInterviews, setSavedInterviews] = useState([]);
  const [selectedSavedId, setSelectedSavedId] = useState('');
  const [speaking, setSpeaking] = useState('idle');
  const [startedAt, setStartedAt] = useState(null);
  const serviceRef = useRef(null);
  const scrollRef = useRef(null);
  const speakingTimerRef = useRef(null);

  const activeTranscript = selectedSavedId
    ? savedInterviews.find((item) => item.id === selectedSavedId)?.transcript || []
    : transcript;
  const activeAssessment = selectedSavedId
    ? savedInterviews.find((item) => item.id === selectedSavedId)?.assessment || null
    : assessment;
  const currentOpportunity = useMemo(() => ({
    id: targetEntity?.id || targetEntity?.name || 'general',
    name: targetEntity?.name || 'General practice',
    role: targetEntity?.role || ''
  }), [targetEntity]);
  const groupedSaved = useMemo(() => groupSavedMockInterviews(savedInterviews), [savedInterviews]);
  const durationSeconds = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;

  useEffect(() => {
    loadSavedInterviews();
    return () => {
      window.clearTimeout(speakingTimerRef.current);
      if (serviceRef.current) {
        serviceRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeTranscript]);

  async function loadSavedInterviews() {
    const items = await api?.listMockInterviews?.();
    setSavedInterviews(Array.isArray(items) ? items : []);
  }

  async function handleConnect() {
    setSelectedSavedId('');
    setAssessment(null);
    setAssessmentStatus('');
    setSaveStatus('');
    setTranscript([]);
    setStartedAt(Date.now());
    if (!serviceRef.current) {
      serviceRef.current = new RealtimeInterviewService(api);
    }

    serviceRef.current.onStateChange = setStatus;
    serviceRef.current.onMessage = (event) => {
      if (event.type === 'input_audio_buffer.speech_started') {
        markSpeaking('you');
      } else if (event.type === 'input_audio_buffer.speech_stopped') {
        markSpeaking('idle');
      } else if (event.type === 'response.output_audio.delta' || event.type === 'response.audio.delta') {
        markSpeaking('interviewer');
      } else if (event.type === 'response.output_audio.done' || event.type === 'response.audio.done') {
        markSpeaking('idle');
      }

      if (event.type === 'response.output_audio_transcript.delta' || event.type === 'response.audio_transcript.delta') {
        markSpeaking('interviewer');
        setTranscript((prev) => appendToTurn(prev, 'interviewer', event.delta, event.response_id));
      } else if (event.type === 'conversation.item.input_audio_transcription.completed') {
        setTranscript((prev) => appendToTurn(prev, 'you', ` ${event.transcript}`, event.item_id));
      } else if (event.type === 'conversation.item.done' && event.item?.role === 'user') {
        const transcriptText = extractInputAudioTranscript(event.item);
        if (transcriptText) {
          setTranscript((prev) => appendToTurn(prev, 'you', ` ${transcriptText}`, event.item.id));
        }
      } else if (event.type === 'error') {
        console.error('Realtime Error from Server:', event.error);
      }
    };

    const companyContext = targetEntity
      ? ` You are interviewing me for ${targetEntity.role || 'the role'} at ${targetEntity.name}. Ask role-relevant questions and push for examples.`
      : ' You are conducting a general software engineering interview.';
    const instructions = `You are a professional mock interviewer. Ask one question at a time, keep responses concise, and follow up when an answer lacks detail.${companyContext}`;

    try {
      await serviceRef.current.connect(instructions);
    } catch (error) {
      setAssessmentStatus('');
      alert(`Failed to connect: ${error.message}`);
    }
  }

  async function handleDisconnect() {
    if (serviceRef.current) {
      serviceRef.current.disconnect();
    }
    markSpeaking('idle');
    setStatus('disconnected');
    if (transcript.length) {
      await generateAssessment(transcript);
    }
  }

  async function generateAssessment(nextTranscript = transcript) {
    setAssessmentStatus('Generating assessment...');
    try {
      const result = await api?.generateMockInterviewAssessment?.({
        opportunity: currentOpportunity,
        transcript: nextTranscript,
        durationSeconds
      });
      setAssessment(result || null);
      setAssessmentStatus(result ? 'Assessment ready.' : 'Assessment could not be generated.');
    } catch (error) {
      setAssessmentStatus(`Assessment failed: ${error.message}`);
    }
  }

  async function saveCurrentMockInterview() {
    if (!transcript.length) {
      setSaveStatus('Nothing to save yet.');
      return;
    }

    setSaveStatus('Saving mock interview...');
    try {
      const saved = await api?.saveMockInterview?.({
        opportunity: currentOpportunity,
        transcript,
        assessment: assessment || {},
        durationSeconds,
        date: new Date().toISOString()
      });
      setSaveStatus('Saved.');
      setSelectedSavedId(saved?.id || '');
      await loadSavedInterviews();
    } catch (error) {
      setSaveStatus(`Save failed: ${error.message}`);
    }
  }

  async function deleteSavedMockInterview(id) {
    if (!id) {
      return;
    }

    try {
      const deleted = await api?.deleteMockInterview?.(id);
      if (!deleted) {
        setSaveStatus('Delete failed.');
        return;
      }

      if (selectedSavedId === id) {
        setSelectedSavedId('');
      }
      setSaveStatus('Deleted saved practice session.');
      await loadSavedInterviews();
    } catch (error) {
      setSaveStatus(`Delete failed: ${error.message}`);
    }
  }

  function markSpeaking(next) {
    window.clearTimeout(speakingTimerRef.current);
    setSpeaking(next);
    if (next !== 'idle') {
      speakingTimerRef.current = window.setTimeout(() => setSpeaking('idle'), 1200);
    }
  }

  function appendToTurn(current, role, delta, id) {
    if (!delta) return current;
    const last = current[current.length - 1];
    if (last && last.id === id) {
      const updated = [...current];
      updated[updated.length - 1] = {
        ...last,
        text: `${last.text}${delta}`
      };
      return updated;
    }
    return [...current, { id, role, text: delta.trimStart() }];
  }

  function extractInputAudioTranscript(item) {
    const content = Array.isArray(item?.content) ? item.content : [];
    const audioPart = content.find((part) => part?.type === 'input_audio' && part.transcript);
    return audioPart?.transcript || '';
  }

  return (
    <div className={`mock-interview-workspace speaking-${speaking}`}>
      <section className="mock-interview-main">
        <div className="mock-interview-header">
          <div>
            <p className="mock-eyebrow">Practice session</p>
            <h2>Mock Interview{targetEntity ? ` - ${targetEntity.name}` : ''}</h2>
            <p>{currentOpportunity.role || 'General interview practice'}</p>
          </div>
          <div className={`mock-status status-${status}`}>
            <span />
            {status}
          </div>
        </div>

        <div className="mock-live-panel">
          <div className="mock-transcript-card" ref={scrollRef}>
            {activeTranscript.length === 0 ? (
              <div className="mock-empty-state">
                {status === 'connected' ? 'Listening...' : 'Start a mock interview to capture the transcript.'}
              </div>
            ) : activeTranscript.map((turn, index) => (
              <article className={`mock-turn ${turn.role === 'you' ? 'candidate' : 'interviewer'}`} key={`${turn.id || turn.role}-${index}`}>
                <strong>{turn.role === 'you' ? 'You' : 'Interviewer'}</strong>
                <p>{turn.text}</p>
              </article>
            ))}
          </div>

          <AssessmentPanel assessment={activeAssessment} status={assessmentStatus} />
        </div>

        <div className="mock-controls">
          <div className={`mock-mic-indicator ${speaking === 'you' ? 'candidate-speaking' : ''}`} title="Microphone activity">
            <MicrophoneIcon />
          </div>
          {status !== 'connected' && status !== 'connecting' ? (
            <button className="primary-action" onClick={handleConnect}>
              Start Interview
            </button>
          ) : (
            <button className="ghost mock-end-button" onClick={handleDisconnect}>
              End Interview
            </button>
          )}
          {transcript.length ? (
            <button className="ghost" onClick={saveCurrentMockInterview} disabled={!assessment && assessmentStatus.startsWith('Generating')}>
              Save transcript and scorecard
            </button>
          ) : null}
          {saveStatus ? <small>{saveStatus}</small> : null}
        </div>
      </section>

      <aside className="mock-library" aria-label="Saved mock interviews">
        <div className="mock-library-head">
          <span>Saved practice</span>
          <button type="button" className="ghost" onClick={loadSavedInterviews}>Refresh</button>
        </div>
        {groupedSaved.length ? groupedSaved.map((group) => (
          <section className="mock-folder" key={group.key}>
            <h3>{group.name}</h3>
            <p>{group.role || 'No role saved'}</p>
            <div className="mock-folder-items">
              {group.items.map((item) => (
                <div className={selectedSavedId === item.id ? 'mock-saved-item active' : 'mock-saved-item'} key={item.id}>
                  <button type="button" className="mock-saved-select" onClick={() => setSelectedSavedId(item.id)}>
                    <span>{new Date(item.date).toLocaleDateString()}</span>
                    <strong>{item.assessment?.overallScore || 0}/100</strong>
                    <small>Transcript + scorecard</small>
                  </button>
                  <button
                    type="button"
                    className="mock-delete-button"
                    aria-label={`Delete saved practice from ${new Date(item.date).toLocaleDateString()}`}
                    title="Delete transcript and scorecard"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteSavedMockInterview(item.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </section>
        )) : (
          <div className="mock-library-empty">Saved mock interviews will appear here.</div>
        )}
      </aside>
    </div>
  );
}

function AssessmentPanel({ assessment, status }) {
  if (!assessment) {
    return (
      <section className="mock-assessment-card empty">
        <span>Scorecard</span>
        <h3>{status || 'No assessment yet'}</h3>
        <p>End a mock interview to generate feedback and save the transcript.</p>
      </section>
    );
  }

  return (
    <section className="mock-assessment-card">
      <div className="score-hero">
        <div className="score-ring" style={{ '--score': `${assessment.overallScore}%` }}>
          <strong>{assessment.overallScore}</strong>
          <span>/100</span>
        </div>
        <div>
          <span>Overall assessment</span>
          <h3>{assessment.verdict || 'Practice complete'}</h3>
          <p>{assessment.executiveSummary}</p>
        </div>
      </div>

      <div className="score-grid">
        {(assessment.categories || []).map((category) => (
          <article className="score-category" key={category.name}>
            <div>
              <strong>{category.name}</strong>
              <span>{category.score}/100</span>
            </div>
            <div className="score-bar"><span style={{ width: `${category.score}%` }} /></div>
            <p>{category.rationale}</p>
          </article>
        ))}
      </div>

      <div className="assessment-columns">
        <AssessmentList title="Strengths" items={assessment.strengths} />
        <AssessmentList title="Risks" items={assessment.risks} />
        <AssessmentList title="Action plan" items={assessment.actionPlan} />
      </div>

      {(assessment.answerReviews || []).length ? (
        <div className="answer-reviews">
          <h4>Answer review</h4>
          {assessment.answerReviews.map((review, index) => (
            <article key={`${review.question}-${index}`}>
              <div>
                <strong>{review.question || `Answer ${index + 1}`}</strong>
                <span>{review.score}/100</span>
              </div>
              <p>{review.feedback}</p>
              {review.betterAnswer ? <blockquote>{review.betterAnswer}</blockquote> : null}
            </article>
          ))}
        </div>
      ) : null}

      {assessment.nextPracticePrompt ? (
        <div className="next-practice">
          <span>Next drill</span>
          <p>{assessment.nextPracticePrompt}</p>
        </div>
      ) : null}
    </section>
  );
}

function AssessmentList({ title, items = [] }) {
  if (!items.length) {
    return null;
  }

  return (
    <section>
      <h4>{title}</h4>
      <ul>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}

function groupSavedMockInterviews(items = []) {
  const groups = new Map();
  for (const item of items) {
    const opportunity = item.opportunity || {};
    const key = opportunity.id || opportunity.name || 'general';
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: opportunity.name || 'General practice',
        role: opportunity.role || '',
        items: []
      });
    }
    groups.get(key).items.push(item);
  }
  return Array.from(groups.values());
}

function MicrophoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
      <path d="M8 21h8" />
    </svg>
  );
}
