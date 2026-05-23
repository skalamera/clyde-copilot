import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RealtimeInterviewService } from './realtimeInterviewService';

const proBadgeUrl = new URL('../../clyde_pro-badge.svg', import.meta.url).href;

export function RealtimeInterview({ api, targetEntity, settings = {} }) {
  const [status, setStatus] = useState('disconnected');
  const [transcript, setTranscript] = useState([]);
  const [assessment, setAssessment] = useState(null);
  const [assessmentStatus, setAssessmentStatus] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [savedInterviews, setSavedInterviews] = useState([]);
  const [selectedSavedId, setSelectedSavedId] = useState('');
  const [speaking, setSpeaking] = useState('idle');
  const [startedAt, setStartedAt] = useState(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryTab, setLibraryTab] = useState('scorecard');

  const serviceRef = useRef(null);
  const scrollRef = useRef(null);
  const savedTranscriptRef = useRef(null);
  const speakingTimerRef = useRef(null);
  const videoRef = useRef(null);
  const transcriptRef = useRef([]);
  const assessmentRef = useRef(null);
  const statusRef = useRef('disconnected');
  const finalizingRef = useRef(false);
  const sessionDateRef = useRef('');

  const currentOpportunity = useMemo(() => ({
    id: targetEntity?.id || targetEntity?.name || 'general',
    name: targetEntity?.name || 'General practice',
    role: targetEntity?.role || ''
  }), [targetEntity]);
  const groupedSaved = useMemo(() => groupSavedMockInterviews(savedInterviews), [savedInterviews]);
  const selectedSaved = savedInterviews.find((item) => item.id === selectedSavedId) || null;
  const activeSavedTranscript = selectedSaved?.transcript || [];
  const activeSavedAssessment = selectedSaved?.assessment || null;
  const durationSeconds = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
  const isLive = status === 'connected' || status === 'connecting';

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
  }, [transcript]);

  useEffect(() => {
    if (savedTranscriptRef.current) {
      savedTranscriptRef.current.scrollTop = 0;
    }
  }, [selectedSavedId, libraryTab]);

  async function loadSavedInterviews() {
    const items = await api?.listMockInterviews?.();
    setSavedInterviews(Array.isArray(items) ? items : []);
  }

  async function handleConnect() {
    setSelectedSavedId('');
    setAssessmentState(null);
    setAssessmentStatus('');
    setSaveStatus('');
    setTranscriptState([]);
    setStartedAt(Date.now());
    setLibraryOpen(false);
    finalizingRef.current = false;
    sessionDateRef.current = new Date().toISOString();

    if (!serviceRef.current) {
      serviceRef.current = new RealtimeInterviewService();
    }

    if (videoRef.current) {
      serviceRef.current.setVideoElement(videoRef.current);
    }

    serviceRef.current.onStateChange = handleServiceStateChange;
    serviceRef.current.onMessage = handleServiceMessage;

    try {
      await serviceRef.current.connect({ opportunity: currentOpportunity });
    } catch (error) {
      setAssessmentStatus('');
      setSaveStatus(`Start failed: ${error.message}`);
    }
  }

  function handleServiceStateChange(nextStatus) {
    const previousStatus = statusRef.current;
    statusRef.current = nextStatus;
    setStatus(nextStatus);

    const endedByService = nextStatus === 'disconnected' && previousStatus !== 'disconnected';
    if (endedByService && transcriptRef.current.length && !finalizingRef.current) {
      finalizeInterview({ disconnect: false });
    }
  }

  function handleServiceMessage(event) {
    if (event.type === 'input_audio_buffer.speech_started') {
      markSpeaking('you');
    } else if (event.type === 'input_audio_buffer.speech_stopped') {
      markSpeaking('idle');
    } else if (event.type === 'response.audio.delta') {
      markSpeaking('interviewer');
    } else if (event.type === 'response.audio.done') {
      markSpeaking('idle');
    } else if (event.type === 'conversation.item.input_audio_transcription.completed') {
      setTranscriptState((prev) => upsertTurn(prev, 'you', event.transcript, event.item_id));
    } else if (event.type === 'response.output_text.delta') {
      setTranscriptState((prev) => upsertTurn(prev, 'interviewer', event.delta, event.response_id));
    } else if (event.type === 'error') {
      setSaveStatus(`Live avatar error: ${event.error?.message || 'connection failed'}`);
    }
  }

  async function handleDisconnect() {
    await finalizeInterview({ disconnect: true });
  }

  async function finalizeInterview({ disconnect = true } = {}) {
    if (finalizingRef.current) {
      return;
    }
    finalizingRef.current = true;

    const transcriptSnapshot = transcriptRef.current.filter((turn) => turn?.text);
    if (disconnect && serviceRef.current) {
      serviceRef.current.disconnect();
    }
    markSpeaking('idle');
    setStatus('disconnected');
    statusRef.current = 'disconnected';

    if (!transcriptSnapshot.length) {
      setSaveStatus('Nothing to save yet.');
      finalizingRef.current = false;
      return;
    }

    const saved = await saveCurrentMockInterview({
      transcriptOverride: transcriptSnapshot,
      assessmentOverride: assessmentRef.current || {},
      statusText: 'Saving transcript...'
    });

    if (saved?.id) {
      setSelectedSavedId(saved.id);
      setLibraryOpen(true);
      setLibraryTab('transcript');
    }

    const result = await generateAssessment(transcriptSnapshot);
    if (result && saved?.id) {
      await saveCurrentMockInterview({
        idOverride: saved.id,
        transcriptOverride: transcriptSnapshot,
        assessmentOverride: result,
        statusText: 'Saving scorecard...'
      });
      setLibraryTab('scorecard');
    }
    finalizingRef.current = false;
  }

  async function generateAssessment(nextTranscript = transcript) {
    setAssessmentStatus('Generating assessment...');
    try {
      const result = await api?.generateMockInterviewAssessment?.({
        opportunity: currentOpportunity,
        transcript: nextTranscript,
        durationSeconds
      });
      setAssessmentState(result || null);
      setAssessmentStatus(result ? 'Assessment ready.' : 'Assessment could not be generated.');
      return result || null;
    } catch (error) {
      setAssessmentStatus(`Assessment failed: ${error.message}`);
      return null;
    }
  }

  async function saveCurrentMockInterview({ idOverride, transcriptOverride, assessmentOverride, statusText } = {}) {
    const transcriptToSave = Array.isArray(transcriptOverride) ? transcriptOverride : transcriptRef.current;
    const assessmentToSave = assessmentOverride || assessmentRef.current || {};

    if (!transcriptToSave.length) {
      setSaveStatus('Nothing to save yet.');
      return null;
    }

    setSaveStatus(statusText || 'Saving mock interview...');
    try {
      const saved = await api?.saveMockInterview?.({
        ...(idOverride ? { id: idOverride } : {}),
        opportunity: currentOpportunity,
        transcript: transcriptToSave,
        assessment: assessmentToSave,
        avatar: {},
        durationSeconds,
        date: sessionDateRef.current || new Date().toISOString()
      });
      setSaveStatus(saved?.assessment?.overallScore ? 'Saved transcript and scorecard.' : 'Saved transcript.');
      setSelectedSavedId(saved?.id || '');
      await loadSavedInterviews();
      return saved || null;
    } catch (error) {
      setSaveStatus(`Save failed: ${error.message}`);
      return null;
    }
  }

  function setTranscriptState(nextTranscript) {
    setTranscript((current) => {
      const next = typeof nextTranscript === 'function' ? nextTranscript(current) : nextTranscript;
      transcriptRef.current = Array.isArray(next) ? next : [];
      return transcriptRef.current;
    });
  }

  function setAssessmentState(nextAssessment) {
    assessmentRef.current = nextAssessment || null;
    setAssessment(assessmentRef.current);
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

  function selectSavedInterview(id, tab = libraryTab) {
    setSelectedSavedId(id);
    setLibraryTab(tab);
    setLibraryOpen(true);
  }

  function markSpeaking(next) {
    window.clearTimeout(speakingTimerRef.current);
    setSpeaking(next);
    if (next !== 'idle') {
      speakingTimerRef.current = window.setTimeout(() => setSpeaking('idle'), 1200);
    }
  }

  function upsertTurn(current, role, text, id) {
    if (!text) return current;
    const turnId = id || `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const normalizedText = text.trimStart();
    const last = current[current.length - 1];
    const existingIndex = current.findIndex((turn) => turn.id === turnId);
    if (existingIndex !== -1) {
      const updated = [...current];
      updated[existingIndex] = { ...updated[existingIndex], text: normalizedText };
      return updated;
    }
    if (last && last.role === role && normalizeTurnText(last.text) === normalizeTurnText(normalizedText)) {
      return current;
    }
    if (last && last.id === turnId) {
      const updated = [...current];
      updated[updated.length - 1] = { ...last, text: normalizedText };
      return updated;
    }
    return [...current, { id: turnId, role, text: normalizedText }];
  }

  function normalizeTurnText(text = '') {
    return text.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  return (
    <div className={`mock-interview-workspace ${libraryOpen ? 'library-open' : 'library-collapsed'} speaking-${speaking}`}>
      <section className="mock-interview-main">
          <div className="mock-interview-header">
            <div>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  Mock Interview <img src={proBadgeUrl} alt="Pro" style={{ height: '22px', width: 'auto', display: 'inline-block', transform: 'translateY(-1px)' }} />
                  {targetEntity ? ` - ${targetEntity.name}` : ''}
                </h2>
              <p>{currentOpportunity.role || 'General interview practice'}</p>
            </div>
            <div className="mock-header-actions">
            <button type="button" className="ghost" onClick={() => setLibraryOpen(true)}>
              Saved interviews
            </button>
            <div className={`mock-status status-${status}`}>
              <span />
              {status}
            </div>
          </div>
        </div>

        <div className="mock-stage-shell">
          <div className={`mock-avatar-container status-${status}`}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{ display: status === 'connected' ? 'block' : 'none' }}
            />
            {status !== 'connected' && (
              <div className="mock-avatar-ready">
                <span>{status === 'connecting' ? 'Connecting' : 'Ready'}</span>
                <strong>{status === 'connecting' ? 'Preparing interviewer' : 'Start interview'}</strong>
              </div>
            )}
          </div>

          <div className="mock-transcript-dock">
            <div className="mock-dock-head">
              <span>Live transcript</span>
              <small>{transcript.length} turns</small>
            </div>
            <div className="mock-transcript-card" ref={scrollRef}>
              {transcript.length === 0 ? (
                <div className="mock-empty-state">
                  {status === 'connected' ? 'Listening...' : 'The live transcript appears here.'}
                </div>
              ) : transcript.map((turn, index) => (
                <article className={`mock-turn ${turn.role === 'you' ? 'candidate' : 'interviewer'}`} key={`${turn.id || turn.role}-${index}`}>
                  <strong>{turn.role === 'you' ? 'You' : 'Interviewer'}</strong>
                  <p>{turn.text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="mock-controls">
          <div className={`mock-mic-indicator ${speaking === 'you' ? 'candidate-speaking' : ''}`} title="Microphone activity">
            <MicrophoneIcon />
          </div>
          {!isLive ? (
            <button className="primary-action" onClick={handleConnect}>
              Start Interview
            </button>
          ) : (
            <button className="ghost mock-end-button" onClick={handleDisconnect}>
              End Interview
            </button>
          )}
          {transcript.length ? (
            <button className="ghost" onClick={() => saveCurrentMockInterview()} disabled={!assessment && assessmentStatus.startsWith('Generating')}>
              Save now
            </button>
          ) : null}
          {assessmentStatus ? <small>{assessmentStatus}</small> : null}
          {saveStatus ? <small>{saveStatus}</small> : null}
        </div>
      </section>

      {!libraryOpen ? (
        <button
          type="button"
          className="mock-library-rail"
          onClick={() => setLibraryOpen(true)}
          aria-label="Open saved mock interviews"
        >
          <span>{savedInterviews.length}</span>
          Saved
        </button>
      ) : null}

      <aside className={`mock-library-modal ${libraryOpen ? 'open' : 'closed'}`} aria-label="Saved mock interviews">
        <div className="mock-library-head">
          <div>
            <span>Saved mock interviews</span>
            <small>{savedInterviews.length} saved</small>
          </div>
          <div className="mock-library-actions">
            <button type="button" className="ghost" onClick={loadSavedInterviews}>Refresh</button>
            <button type="button" className="ghost" onClick={() => setLibraryOpen(false)} aria-label="Collapse saved mock interviews">Collapse</button>
          </div>
        </div>

        <div className="mock-library-body">
          <div className="mock-saved-list">
            {groupedSaved.length ? groupedSaved.map((group) => (
              <section className="mock-folder" key={group.key}>
                <h3>{group.name}</h3>
                <p>{group.role || 'No role saved'}</p>
                <div className="mock-folder-items">
                  {group.items.map((item) => (
                    <div className={selectedSavedId === item.id ? 'mock-saved-item active' : 'mock-saved-item'} key={item.id}>
                      <button type="button" className="mock-saved-select" onClick={() => selectSavedInterview(item.id)}>
                        <span>{new Date(item.date).toLocaleDateString()}</span>
                        <strong>{item.assessment?.overallScore || 0}/100</strong>
                        <small>{(item.transcript || []).length} transcript turns</small>
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
          </div>

          <div className="mock-saved-detail">
            {selectedSaved ? (
              <>
                <div className="mock-saved-detail-head">
                  <div>
                    <strong>{selectedSaved.opportunity?.name || 'General practice'}</strong>
                    <small>{new Date(selectedSaved.date).toLocaleString()}</small>
                  </div>
                  <div className="mock-saved-tabs">
                    <button type="button" className={libraryTab === 'scorecard' ? 'active' : ''} onClick={() => setLibraryTab('scorecard')}>
                      Scorecard
                    </button>
                    <button type="button" className={libraryTab === 'transcript' ? 'active' : ''} onClick={() => setLibraryTab('transcript')}>
                      Transcript
                    </button>
                  </div>
                </div>
                {libraryTab === 'scorecard' ? (
                  <AssessmentPanel assessment={activeSavedAssessment} status="Scorecard pending" />
                ) : (
                  <SavedTranscriptPanel transcript={activeSavedTranscript} panelRef={savedTranscriptRef} />
                )}
              </>
            ) : (
              <div className="mock-library-empty">Select a saved interview to view its transcript and scorecard.</div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function SavedTranscriptPanel({ transcript = [], panelRef }) {
  return (
    <section className="mock-saved-transcript" ref={panelRef}>
      {transcript.length ? transcript.map((turn, index) => (
        <article className={`mock-turn ${turn.role === 'you' ? 'candidate' : 'interviewer'}`} key={`${turn.id || turn.role}-${index}`}>
          <strong>{turn.role === 'you' ? 'You' : 'Interviewer'}</strong>
          <p>{turn.text}</p>
        </article>
      )) : (
        <div className="mock-empty-state">No transcript was saved for this session.</div>
      )}
    </section>
  );
}

function AssessmentPanel({ assessment, status }) {
  if (!assessment || !assessment.overallScore) {
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
