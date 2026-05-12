import { useCallback, useEffect, useMemo, useState } from 'react';

const logoUrl = new URL('../../clyde.svg', import.meta.url).href;

const DEFAULT_HEALTH = {
  audio: { state: 'unknown', label: 'Audio', detail: 'Not checked yet.' },
  whisper: { state: 'unknown', label: 'Transcription', detail: 'Not checked yet.' },
  lmStudio: { state: 'unknown', label: 'Assistant LLM', detail: 'Not checked yet.' },
  capture: { state: 'idle', label: 'Capture', detail: 'Stopped.' }
};

const EMPTY_SETTINGS = {
  appMode: 'interview',
  llmProvider: 'local',
  llmModel: '',
  llmApiKey: '',
  localLlmUrl: 'http://localhost:1234/v1/chat/completions',
  transcriptionProvider: 'local',
  transcriptionApiKey: '',
  localTranscriptionUrl: 'http://localhost:8000/v1/audio/transcriptions',
  resumeText: '',
  currentCompany: '',
  currentRole: '',
  meetingTitle: '',
  meetingAttendees: [],
  meetingMemory: '',
  screenShareHidden: true,
  ragEnabled: false,
  pineconeApiKey: '',
  pineconeHost: ''
};

const COMMANDS = [
  { id: 'assist', label: 'Assist' },
  { id: 'recap', label: 'Recap' },
  { id: 'follow_up', label: 'Follow-up questions' },
  { id: 'resume', label: 'Answer from resume' },
  { id: 'summary', label: 'Summarize last 2 minutes' },
  { id: 'note', label: 'Save note' }
];

function App() {
  const api = window.electronAPI;
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [mode, setMode] = useState('interview');
  const [status, setStatus] = useState('Awaiting initialization...');
  const [isStreaming, setIsStreaming] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [assistantCards, setAssistantCards] = useState([]);
  const [health, setHealth] = useState(DEFAULT_HEALTH);
  const [liveLevels, setLiveLevels] = useState([]);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(true);
  const [entities, setEntities] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState('');
  const [commandText, setCommandText] = useState('');
  const [activeTab, setActiveTab] = useState('prep');
  const [serviceChecking, setServiceChecking] = useState(false);

  const context = useMemo(() => {
    if (mode === 'meeting') {
      return {
        title: settings.meetingTitle || 'Untitled meeting',
        subtitle: attendeeSummary(settings.meetingAttendees),
        brief: settings.meetingMemory || 'No meeting memory saved yet.'
      };
    }

    return {
      title: settings.currentCompany || 'No active company',
      subtitle: settings.currentRole || 'No role selected',
      brief: settings.resumeText ? `${settings.resumeText.length.toLocaleString()} characters of resume context loaded.` : 'No resume context loaded.'
    };
  }, [mode, settings]);

  const transcriptText = useMemo(
    () => transcript.map((turn) => `${turn.speaker}: ${turn.text}`).join('\n'),
    [transcript]
  );

  const filteredCards = useMemo(
    () => assistantCards.filter((card) => card.body || card.question || (card.bullets && card.bullets.length)),
    [assistantCards]
  );

  const reloadSessions = useCallback(async (nextMode = mode, nextEntity = '') => {
    if (!api?.getSessionEntities || !api?.getSessions) {
      return;
    }

    const nextEntities = await api.getSessionEntities(nextMode);
    setEntities(nextEntities);

    const fallbackEntity = nextEntity || nextEntities[0]?.id || '';
    setSelectedEntity(fallbackEntity);
    const nextSessions = await api.getSessions({
      mode: nextMode,
      entityId: fallbackEntity || undefined
    });
    setSessions(nextSessions);
  }, [api, mode]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!api?.loadSettings) {
        return;
      }

      const loaded = await api.loadSettings();
      if (!mounted) {
        return;
      }

      const nextSettings = { ...EMPTY_SETTINGS, ...(loaded || {}) };
      setSettings(nextSettings);
      setMode(nextSettings.appMode === 'meeting' ? 'meeting' : 'interview');
      setSetupOpen(!nextSettings.currentCompany && !nextSettings.meetingTitle);
    }

    load().catch((error) => setStatus(`Settings failed: ${error.message}`));

    api?.onAudioStatus?.((_event, nextStatus) => {
      if (!nextStatus?.message) {
        return;
      }
      setStatus(nextStatus.message);
      if (nextStatus.state === 'capturing') {
        setIsStreaming(true);
      }
      if (nextStatus.state === 'idle' || nextStatus.state === 'error') {
        setIsStreaming(false);
      }
    });

    api?.onHealthUpdate?.((_event, nextHealth) => {
      if (nextHealth && typeof nextHealth === 'object') {
        setHealth(nextHealth);
      }
    });

    api?.onAudioLevelUpdate?.((_event, update) => {
      if ((update?.type === 'live-started' || update?.type === 'live-levels') && Array.isArray(update.sources)) {
        setLiveLevels(update.sources);
      }
      if (update?.type === 'live-stopped') {
        setLiveLevels([]);
      }
    });

    api?.onTranscriptUpdate?.((_event, turn) => {
      if (!turn?.text) {
        return;
      }
      setTranscript((current) => mergeTranscriptTurn(current, turn));
    });

    api?.onAssistantUpdate?.((_event, update) => {
      const nextCards = Array.isArray(update?.cards) && update.cards.length
        ? update.cards
        : [{ type: 'note', title: update?.title || 'Live help', body: update?.text || '' }];
      setAssistantCards(nextCards.map(normalizeCardForRender));
    });

    api?.onSessionReset?.(() => {
      setTranscript([]);
      setAssistantCards([]);
      setStatus('Session reset.');
    });

    return () => {
      mounted = false;
    };
  }, [api]);

  useEffect(() => {
    reloadSessions(mode).catch((error) => setStatus(`Timeline failed: ${error.message}`));
  }, [mode, reloadSessions]);

  async function chooseMode(nextMode) {
    setMode(nextMode);
    const nextSettings = { ...settings, appMode: nextMode };
    setSettings(nextSettings);
    await api?.setActiveSessionContext?.({ mode: nextMode });
    await reloadSessions(nextMode, '');
  }

  async function saveSettings(nextSettings) {
    const normalized = {
      ...settings,
      ...nextSettings,
      appMode: mode,
      meetingAttendees: parseAttendees(nextSettings.meetingAttendeesText ?? attendeeLines(nextSettings.meetingAttendees || settings.meetingAttendees))
    };

    delete normalized.meetingAttendeesText;
    await api?.saveSettings?.(normalized);
    await api?.setActiveSessionContext?.({
      mode,
      company: normalized.currentCompany,
      role: normalized.currentRole,
      meetingTitle: normalized.meetingTitle,
      attendees: normalized.meetingAttendees,
      memory: normalized.meetingMemory,
      screenShareHidden: normalized.screenShareHidden
    });
    setSettings(normalized);
    setSettingsOpen(false);
    setSetupOpen(false);
    setStatus('Settings saved.');
    await reloadSessions(mode);
  }

  async function validateServices() {
    setServiceChecking(true);
    try {
      const nextHealth = await api?.validateServices?.(settings);
      if (nextHealth) {
        setHealth(nextHealth);
      }
      setStatus('Service check complete.');
    } catch (error) {
      setStatus(`Service check failed: ${error.message}`);
    } finally {
      setServiceChecking(false);
    }
  }

  function startCapture() {
    setTranscript([]);
    setAssistantCards([]);
    setStatus('Starting audio capture...');
    setIsStreaming(true);
    api?.startTranscription?.();
  }

  function stopCapture() {
    api?.stopTranscription?.();
    setIsStreaming(false);
    setStatus('Capture stopped. Save the session when ready.');
  }

  function resetSession() {
    api?.resetSession?.();
    setTranscript([]);
    setAssistantCards([]);
    setLiveLevels([]);
  }

  async function saveCurrentSession() {
    if (!transcript.length) {
      setStatus('No transcript captured yet.');
      return;
    }

    try {
      if (mode === 'interview') {
        await saveInterviewSession();
      } else {
        await saveMeetingSession();
      }

      setStatus('Session saved.');
      setTimelineOpen(true);
      await reloadSessions(mode);
    } catch (error) {
      setStatus(`Save failed: ${error.message}`);
    }
  }

  async function saveInterviewSession() {
    const company = settings.currentCompany || 'Interview';
    const phase = 'Live Session';

    try {
      await api?.saveInterview?.({
        company,
        role: settings.currentRole || '',
        phase,
        interviewerName: '',
        interviewerTitle: ''
      });
    } catch (_error) {
      await api?.saveSession?.({
        mode: 'interview',
        entity: {
          id: company,
          name: company,
          role: settings.currentRole || ''
        },
        title: phase,
        phase,
        transcript,
        notes: buildNotes(transcript, assistantCards),
        cards: assistantCards,
        grading: { status: 'pending' }
      });
    }
  }

  async function saveMeetingSession() {
    const title = settings.meetingTitle || 'Meeting';
    await api?.saveSession?.({
      mode: 'meeting',
      entity: {
        id: title,
        name: title,
        role: ''
      },
      title,
      attendees: settings.meetingAttendees || [],
      transcript,
      notes: buildNotes(transcript, assistantCards),
      cards: assistantCards,
      grading: null
    });
  }

  async function runCommand(command) {
    if (command === 'assist' || command === 'resume') {
      setStatus('Asking Clyde for live help...');
      api?.requestSuggestion?.();
      return;
    }

    const nextCard = makeLocalCommandCard(command, transcript, { ...settings, appMode: mode });
    if (nextCard) {
      setAssistantCards((current) => [nextCard, ...current].slice(0, 6));
    }
  }

  function submitCommand(event) {
    event.preventDefault();
    const value = commandText.trim();
    if (!value) {
      return;
    }

    setAssistantCards((current) => [{
      id: `note-${Date.now()}`,
      type: 'note',
      title: 'Saved note',
      body: value
    }, ...current]);
    setCommandText('');
  }

  function chooseWorkspaceView(nextView) {
    const nextTimelineOpen = nextView === 'timeline';
    setTimelineOpen(nextTimelineOpen);
    if (nextTimelineOpen) {
      reloadSessions(mode, selectedEntity).catch((error) => setStatus(`Timeline failed: ${error.message}`));
    }
  }

  return (
    <div className="app-shell">
      <TitleBar
        mode={mode}
        onModeChange={chooseMode}
        onSettings={() => setSettingsOpen(true)}
      />

      <main className={`workspace ${timelineOpen ? 'workspace-timeline' : ''}`}>
        <BrandMasthead />

        <WorkspaceNav
          entityCount={entities.length}
          isStreaming={isStreaming}
          mode={mode}
          onViewChange={chooseWorkspaceView}
          view={timelineOpen ? 'timeline' : 'live'}
        />

        {timelineOpen ? (
          <TimelineView
            entities={entities}
            mode={mode}
            onRefresh={() => reloadSessions(mode, selectedEntity)}
            onSelectEntity={async (entityId) => {
              setSelectedEntity(entityId);
              const nextSessions = await api?.getSessions?.({ mode, entityId });
              setSessions(nextSessions || []);
            }}
            selectedEntity={selectedEntity}
            sessions={sessions}
          />
        ) : <>
          <StatusStrip
            health={health}
            isStreaming={isStreaming}
            mode={mode}
            provider={settings.llmProvider}
            screenShareHidden={settings.screenShareHidden}
            status={status}
          />

          {setupOpen ? (
            <SetupPanel
              mode={mode}
              onClose={() => setSetupOpen(false)}
              onSave={saveSettings}
              onValidate={validateServices}
              serviceChecking={serviceChecking}
              settings={settings}
            />
          ) : null}

          <section className="live-grid">
            <LivePanel
              cards={filteredCards}
              commandText={commandText}
              context={context}
              isStreaming={isStreaming}
              liveLevels={liveLevels}
              mode={mode}
              onCommand={runCommand}
              onCommandText={setCommandText}
              onReset={resetSession}
              onSave={saveCurrentSession}
              onStart={startCapture}
              onStop={stopCapture}
              onSubmitCommand={submitCommand}
              status={status}
              transcript={transcript}
            />
            <ContextPanel
              activeTab={activeTab}
              cards={filteredCards}
              mode={mode}
              onTab={setActiveTab}
              settings={settings}
              transcriptText={transcriptText}
            />
          </section>
        </>}
      </main>

      {settingsOpen ? (
        <SettingsDrawer
          mode={mode}
          onClose={() => setSettingsOpen(false)}
          onSave={saveSettings}
          onValidate={validateServices}
          serviceChecking={serviceChecking}
          settings={settings}
        />
      ) : null}
    </div>
  );
}

function TitleBar({ mode, onModeChange, onSettings }) {
  return (
    <header className="title-bar">
      <div className="window-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="title-center">
        <ModeToggle mode={mode} onChange={onModeChange} />
      </div>
      <div className="title-actions">
        <button className="icon-button" type="button" onClick={onSettings} aria-label="Settings" title="Settings">
          <GearIcon />
        </button>
      </div>
    </header>
  );
}

function BrandMasthead() {
  return (
    <div className="brand-masthead">
      <img src={logoUrl} alt="" className="brand-mark" />
      <h1>Clyde</h1>
    </div>
  );
}

function GearIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" />
      <path d="M18.7 13.4c.05-.46.05-.88 0-1.34l2-1.5-2-3.46-2.38 1a8.26 8.26 0 0 0-1.16-.68L14.86 5h-4.02l-.3 2.42c-.42.18-.8.4-1.16.68L7 7.1l-2 3.46 2 1.5c-.05.46-.05.88 0 1.34l-2 1.5 2 3.46 2.38-1c.36.28.74.5 1.16.68l.3 2.42h4.02l.3-2.42c.42-.18.8-.4 1.16-.68l2.38 1 2-3.46-2-1.5Z" />
    </svg>
  );
}

function WorkspaceNav({ entityCount, isStreaming, mode, onViewChange, view }) {
  const timelineLabel = mode === 'interview' ? 'Interview timeline' : 'Meeting memory';
  const timelineHint = mode === 'interview' ? 'Companies, transcripts, grades' : 'Notes, actions, transcripts';
  const recordLabel = entityCount === 1 ? '1 record' : `${entityCount} records`;

  return (
    <nav className="workspace-nav" aria-label="Workspace view">
      <div className="view-tabs">
        <button
          className={view === 'live' ? 'view-tab active' : 'view-tab'}
          type="button"
          aria-pressed={view === 'live'}
          onClick={() => onViewChange('live')}
        >
          <span>Now</span>
          <strong>Live assist</strong>
        </button>
        <button
          className={view === 'timeline' ? 'view-tab active' : 'view-tab'}
          data-testid="timelineNav"
          type="button"
          aria-pressed={view === 'timeline'}
          onClick={() => onViewChange('timeline')}
        >
          <span>{timelineHint}</span>
          <strong>{timelineLabel}</strong>
        </button>
      </div>
      <div className="workspace-nav-status" aria-live="polite">
        <span className={`status-dot ${isStreaming ? 'live' : ''}`} />
        <span>{isStreaming ? 'Capture live' : 'Capture idle'}</span>
        <span>{recordLabel}</span>
      </div>
    </nav>
  );
}

function ModeToggle({ mode, onChange }) {
  return (
    <div className="mode-toggle" aria-label="Mode selector">
      <button
        className={mode === 'interview' ? 'active' : ''}
        data-testid="mode-interview"
        type="button"
        onClick={() => onChange('interview')}
      >
        Interview
      </button>
      <button
        className={mode === 'meeting' ? 'active' : ''}
        data-testid="mode-meeting"
        type="button"
        onClick={() => onChange('meeting')}
      >
        Meeting
      </button>
    </div>
  );
}

function StatusStrip({ health, isStreaming, mode, provider, screenShareHidden, status }) {
  return (
    <div className="status-strip">
      <div className="status-line">
        <span className={`pulse ${isStreaming ? 'live' : ''}`} />
        <span>{status}</span>
      </div>
      <div className="status-pills">
        <span>{provider === 'local' ? 'Local LLM' : `${provider} cloud`}</span>
        <span>{mode === 'interview' ? 'Candidate context' : 'Meeting memory'}</span>
        <span>{screenShareHidden ? 'Screen-share safe' : 'Visible overlay'}</span>
      </div>
      <div className="health-grid" data-testid="healthGrid">
        {Object.entries(health).map(([key, item]) => (
          <div className={`health-card ${item.state || 'unknown'}`} key={key}>
            <span />
            <strong>{item.label || key}</strong>
            <small>{item.detail || 'Not checked yet.'}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function SetupPanel({ mode, onClose, onSave, onValidate, serviceChecking, settings }) {
  return (
    <section className="setup-panel">
      <div>
        <h2>First-run setup</h2>
        <p>Choose context, check providers, test audio, then start a live session.</p>
      </div>
      <SetupFields mode={mode} onSave={onSave} settings={settings} compact />
      <div className="setup-actions">
        <button type="button" onClick={onValidate} disabled={serviceChecking}>
          {serviceChecking ? 'Checking...' : 'Validate services'}
        </button>
        <button type="button" className="ghost" onClick={onClose}>Skip for now</button>
      </div>
    </section>
  );
}

function LivePanel(props) {
  const {
    cards,
    commandText,
    context,
    isStreaming,
    liveLevels,
    mode,
    onCommand,
    onCommandText,
    onReset,
    onSave,
    onStart,
    onStop,
    onSubmitCommand,
    transcript
  } = props;

  return (
    <section className="live-panel">
      <div className="panel-header">
        <div>
          <h2>{context.title}</h2>
          <p>{context.subtitle}</p>
        </div>
        <div className="capture-controls">
          <button data-testid="startBtn" type="button" onClick={onStart} disabled={isStreaming}>Start</button>
          <button data-testid="stopBtn" type="button" onClick={onStop} disabled={!isStreaming}>Stop</button>
          <button data-testid="saveBtn" type="button" onClick={onSave} disabled={isStreaming || transcript.length === 0}>Save</button>
          <button type="button" className="icon-button" onClick={onReset} title="Reset session">Reset</button>
        </div>
      </div>

      <div className="meters" data-testid="liveVoiceMeters">
        {liveLevels.length ? liveLevels.map((source) => (
          <div className={`meter ${source.speaking ? 'speaking' : ''}`} key={source.id || source.label}>
            <div>
              <strong>{source.label || 'Audio'}</strong>
              <span>{Math.round(source.rms || 0)} RMS</span>
            </div>
            <div className="meter-track">
              <span style={{ width: `${Math.max(0, Math.min(100, source.level || 0))}%` }} />
            </div>
          </div>
        )) : (
          <div className="meter empty">
            <div>
              <strong>Audio levels</strong>
              <span>Start capture to monitor sources</span>
            </div>
            <div className="meter-track"><span /></div>
          </div>
        )}
      </div>

      <div className="command-row">
        {COMMANDS.map((command) => (
          <button key={command.id} type="button" onClick={() => onCommand(command.id)}>
            {command.label}
          </button>
        ))}
      </div>

      <form className="command-input" onSubmit={onSubmitCommand}>
        <input
          data-testid="commandInput"
          value={commandText}
          onChange={(event) => onCommandText(event.target.value)}
          placeholder={mode === 'interview' ? 'Save a thought or ask Clyde for a sharper answer...' : 'Save a note, decision, or follow-up...'}
        />
        <button type="submit">Save note</button>
      </form>

      <div className="live-columns">
        <Transcript transcript={transcript} />
        <AssistantCards cards={cards} />
      </div>
    </section>
  );
}

function Transcript({ transcript }) {
  return (
    <div className="transcript-pane">
      <div className="pane-title">
        <h3>Live transcript</h3>
        <span>{transcript.length} turns</span>
      </div>
      <div className="scroll-area">
        {transcript.length ? transcript.map((turn, index) => (
          <article className="turn" key={`${turn.speaker}-${index}`}>
            <strong style={{ color: turn.speakerColor || undefined }}>{turn.speaker || 'Unknown'}</strong>
            <p>{turn.text}</p>
          </article>
        )) : (
          <EmptyState title="Waiting for speech" body="Start capture to stream transcript turns into this pane." />
        )}
      </div>
    </div>
  );
}

function AssistantCards({ cards }) {
  return (
    <div className="assistant-pane">
      <div className="pane-title">
        <h3>Live assistant</h3>
        <span>{cards.length} cards</span>
      </div>
      <div className="scroll-area card-stack">
        {cards.length ? cards.map((card, index) => (
          <article className={`assistant-card ${card.type || 'note'}`} key={card.id || `${card.title}-${index}`}>
            <div className="card-kicker">{labelForCard(card.type)}</div>
            {card.question ? <h4>{card.question}</h4> : <h4>{card.title || labelForCard(card.type)}</h4>}
            {card.body ? <p>{card.body}</p> : null}
            {card.bullets?.length ? (
              <ul>
                {card.bullets.map((bullet, bulletIndex) => <li key={`${bullet}-${bulletIndex}`}>{bullet}</li>)}
              </ul>
            ) : null}
            {card.detail ? <small>{card.detail}</small> : null}
          </article>
        )) : (
          <EmptyState title="No assistant cards yet" body="Clyde will add answers, recaps, risks, and follow-ups here." />
        )}
      </div>
    </div>
  );
}

function ContextPanel({ activeTab, cards, mode, onTab, settings, transcriptText }) {
  const prepItems = mode === 'interview'
    ? [
      ['Company', settings.currentCompany || 'Not set'],
      ['Role', settings.currentRole || 'Not set'],
      ['Resume context', settings.resumeText ? `${settings.resumeText.length.toLocaleString()} characters` : 'Not set']
    ]
    : [
      ['Meeting', settings.meetingTitle || 'Not set'],
      ['Attendees', attendeeSummary(settings.meetingAttendees) || 'Not set'],
      ['Memory', settings.meetingMemory || 'Not set']
    ];

  return (
    <aside className="context-panel">
      <div className="tabs">
        {['prep', 'review', 'privacy'].map((tab) => (
          <button className={activeTab === tab ? 'active' : ''} key={tab} type="button" onClick={() => onTab(tab)}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'prep' ? (
        <div className="context-section">
          <h3>Pre-call prep</h3>
          {prepItems.map(([label, value]) => (
            <div className="info-row" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
          <div className="suggestion-box">
            <strong>Likely topics</strong>
            <p>{mode === 'interview' ? 'Project depth, role fit, constraints, and measurable outcomes.' : 'Decisions, owners, blockers, and follow-up dates.'}</p>
          </div>
        </div>
      ) : null}

      {activeTab === 'review' ? (
        <div className="context-section">
          <h3>Post-call review</h3>
          <div className="info-row">
            <span>Transcript</span>
            <strong>{transcriptText ? `${transcriptText.length.toLocaleString()} characters` : 'No transcript'}</strong>
          </div>
          <div className="info-row">
            <span>Assistant cards</span>
            <strong>{cards.length}</strong>
          </div>
          <div className="suggestion-box">
            <strong>Editable follow-up draft</strong>
            <p>{buildFollowUpDraft(mode, settings, cards)}</p>
          </div>
        </div>
      ) : null}

      {activeTab === 'privacy' ? (
        <div className="context-section">
          <h3>Privacy controls</h3>
          <div className="info-row">
            <span>Provider path</span>
            <strong>{settings.llmProvider === 'local' ? 'Local model' : `${settings.llmProvider} API`}</strong>
          </div>
          <div className="info-row">
            <span>Overlay</span>
            <strong>{settings.screenShareHidden ? 'Screen-share safe' : 'Visible'}</strong>
          </div>
          <div className="hotkeys">
            <span>Ctrl+Shift+A Assist</span>
            <span>Ctrl+Shift+R Recap</span>
            <span>Ctrl+Shift+S Save note</span>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function TimelineView({ entities, mode, onRefresh, onSelectEntity, selectedEntity, sessions }) {
  const selected = entities.find((entity) => entity.id === selectedEntity);

  return (
    <section className="timeline-view" data-testid="sessionTimeline">
      <div className="timeline-rail">
        <div className="timeline-heading">
          <h2>{mode === 'interview' ? 'Interview timeline' : 'Meeting memory'}</h2>
          <button type="button" onClick={onRefresh}>Refresh</button>
        </div>
        <div className="entity-list">
          {entities.length ? entities.map((entity) => (
            <button
              className={entity.id === selectedEntity ? 'active' : ''}
              key={entity.id}
              type="button"
              onClick={() => onSelectEntity(entity.id)}
            >
              <strong>{entity.name}</strong>
              <span>{entity.role || entity.kind}</span>
            </button>
          )) : <EmptyState title="No saved sessions" body="Save a session to build history." />}
        </div>
      </div>

      <div className="timeline-main">
        <div className="timeline-title">
          <div>
            <h2>{selected?.name || 'Select a record'}</h2>
            <p>{sessions.length} saved sessions</p>
          </div>
        </div>
        <div className="session-list">
          {sessions.length ? sessions.map((session) => (
            <SessionBlock key={`${session.mode}-${session.entity.id}-${session.id}`} session={session} />
          )) : <EmptyState title="No sessions selected" body="Choose a company or meeting from the rail." />}
        </div>
      </div>
    </section>
  );
}

function SessionBlock({ session }) {
  return (
    <article className="session-block">
      <div className="session-head">
        <div>
          <h3>{session.title}</h3>
          <p>{new Date(session.date).toLocaleString()}</p>
        </div>
        {session.grading?.grade ? <span className="grade-pill">{session.grading.grade}</span> : <span className="grade-pill muted">{session.mode}</span>}
      </div>
      {session.notes?.summary ? <p className="session-summary">{session.notes.summary}</p> : null}
      {session.notes?.actionItems?.length ? (
        <ul className="action-list">
          {session.notes.actionItems.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
        </ul>
      ) : null}
      <details>
        <summary>Transcript</summary>
        <div className="session-transcript">
          {session.transcript.map((turn, index) => (
            <p key={`${turn.speaker}-${index}`}>
              <strong>{turn.speaker}:</strong> {turn.text}
            </p>
          ))}
        </div>
      </details>
    </article>
  );
}

function SettingsDrawer(props) {
  const { mode, onClose, onSave, onValidate, serviceChecking, settings } = props;

  return (
    <div className="drawer-backdrop">
      <section className="settings-drawer">
        <div className="drawer-head">
          <div>
            <h2>Settings</h2>
            <p>Provider keys are stored by the Electron main process.</p>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <SetupFields mode={mode} onSave={onSave} settings={settings} />
        <div className="drawer-actions">
          <button type="button" onClick={onValidate} disabled={serviceChecking}>
            {serviceChecking ? 'Checking...' : 'Validate services'}
          </button>
        </div>
      </section>
    </div>
  );
}

function SetupFields({ compact = false, mode, onSave, settings }) {
  const [draft, setDraft] = useState({
    ...settings,
    meetingAttendeesText: attendeeLines(settings.meetingAttendees)
  });

  useEffect(() => {
    setDraft({
      ...settings,
      meetingAttendeesText: attendeeLines(settings.meetingAttendees)
    });
  }, [settings]);

  function update(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <form className={`settings-form ${compact ? 'compact' : ''}`} onSubmit={(event) => {
      event.preventDefault();
      onSave(draft);
    }}>
      <div className="form-grid">
        {mode === 'interview' ? (
          <>
            <label>
              Company
              <input value={draft.currentCompany || ''} onChange={(event) => update('currentCompany', event.target.value)} placeholder="Acme Corp" />
            </label>
            <label>
              Role
              <input value={draft.currentRole || ''} onChange={(event) => update('currentRole', event.target.value)} placeholder="Staff Engineer" />
            </label>
          </>
        ) : (
          <>
            <label>
              Meeting title
              <input value={draft.meetingTitle || ''} onChange={(event) => update('meetingTitle', event.target.value)} placeholder="Platform weekly" />
            </label>
            <label>
              Attendees
              <input value={draft.meetingAttendeesText || ''} onChange={(event) => update('meetingAttendeesText', event.target.value)} placeholder="Morgan: PM, Lee: Eng" />
            </label>
          </>
        )}

        <label>
          LLM provider
          <select value={draft.llmProvider || 'local'} onChange={(event) => update('llmProvider', event.target.value)}>
            <option value="local">Local LM Studio</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Google Gemini</option>
          </select>
        </label>
        <label>
          Model
          <input value={draft.llmModel || ''} onChange={(event) => update('llmModel', event.target.value)} placeholder="local-model or provider model" />
        </label>
        <label>
          API key
          <input autoComplete="new-password" type="password" value={draft.llmApiKey || ''} onChange={(event) => update('llmApiKey', event.target.value)} placeholder="Stored locally" />
        </label>
        <label>
          Local LLM URL
          <input value={draft.localLlmUrl || ''} onChange={(event) => update('localLlmUrl', event.target.value)} placeholder="http://localhost:1234/v1/chat/completions" />
        </label>
        <label>
          Transcription provider
          <select value={draft.transcriptionProvider || 'local'} onChange={(event) => update('transcriptionProvider', event.target.value)}>
            <option value="local">Local Whisper</option>
            <option value="openai">OpenAI Whisper</option>
          </select>
        </label>
        <label>
          Transcription URL
          <input value={draft.localTranscriptionUrl || ''} onChange={(event) => update('localTranscriptionUrl', event.target.value)} placeholder="http://localhost:8000/v1/audio/transcriptions" />
        </label>
      </div>

      <label className="wide-field">
        {mode === 'interview' ? 'Resume / background' : 'Meeting memory'}
        <textarea
          value={mode === 'interview' ? (draft.resumeText || '') : (draft.meetingMemory || '')}
          onChange={(event) => update(mode === 'interview' ? 'resumeText' : 'meetingMemory', event.target.value)}
          placeholder={mode === 'interview' ? 'Paste resume facts, metrics, and projects.' : 'Paste prior notes, person context, or recurring meeting memory.'}
        />
      </label>

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={Boolean(draft.screenShareHidden)}
          onChange={(event) => update('screenShareHidden', event.target.checked)}
        />
        Screen-share safe overlay state
      </label>

      <button type="submit" className="primary-action">Save setup</button>
    </form>
  );
}

function EmptyState({ body, title }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function mergeTranscriptTurn(current, turn) {
  const normalized = {
    speaker: turn.speaker || 'Unknown',
    text: String(turn.text || '').trim(),
    speakerColor: turn.speakerColor || ''
  };

  if (!normalized.text) {
    return current;
  }

  const last = current[current.length - 1];
  if (last && last.speaker === normalized.speaker) {
    return [
      ...current.slice(0, -1),
      { ...last, text: `${last.text} ${normalized.text}` }
    ];
  }

  return [...current, normalized];
}

function normalizeCardForRender(card) {
  return {
    id: card.id || `${card.type || 'note'}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: card.type || 'note',
    title: card.title || labelForCard(card.type),
    body: card.body || card.text || '',
    question: card.question || '',
    bullets: Array.isArray(card.bullets) ? card.bullets : [],
    detail: card.detail || card.why || ''
  };
}

function labelForCard(type) {
  return {
    answer: 'Answer',
    suggestion: 'Say next',
    follow_up: 'Follow-up',
    recap: 'Recap',
    action: 'Action',
    risk: 'Watch',
    note: 'Note'
  }[type] || 'Note';
}

function makeLocalCommandCard(command, transcript, settings) {
  const summary = summarizeTranscript(transcript);

  if (command === 'recap') {
    return {
      id: `recap-${Date.now()}`,
      type: 'recap',
      title: 'Recap',
      body: summary || 'No transcript yet.'
    };
  }

  if (command === 'follow_up') {
    return {
      id: `follow-up-${Date.now()}`,
      type: 'follow_up',
      title: 'Follow-up',
      body: settings.appMode === 'meeting'
        ? 'Can we confirm the owner, deadline, and next check-in for this item?'
        : 'Can you tell me what success looks like for this role in the first 90 days?'
    };
  }

  if (command === 'summary') {
    return {
      id: `summary-${Date.now()}`,
      type: 'note',
      title: 'Last segment',
      body: summary || 'No recent transcript to summarize.'
    };
  }

  if (command === 'note') {
    return {
      id: `note-${Date.now()}`,
      type: 'note',
      title: 'Saved note',
      body: 'Marked this moment for post-call review.'
    };
  }

  return null;
}

function summarizeTranscript(transcript) {
  const lastTurns = transcript.slice(-4);
  if (!lastTurns.length) {
    return '';
  }

  return lastTurns.map((turn) => `${turn.speaker}: ${turn.text}`).join(' ');
}

function buildNotes(transcript, cards) {
  return {
    summary: summarizeTranscript(transcript) || 'Session saved from Clyde.',
    actionItems: cards
      .filter((card) => card.type === 'action' || card.type === 'follow_up')
      .map((card) => card.body || card.question)
      .filter(Boolean)
  };
}

function buildFollowUpDraft(mode, settings, cards) {
  const actions = cards
    .filter((card) => card.type === 'action' || card.type === 'follow_up')
    .map((card) => card.body || card.question)
    .filter(Boolean);

  if (mode === 'interview') {
    return `Thanks again for the conversation about ${settings.currentRole || 'the role'}. I appreciated learning more and wanted to follow up on ${actions[0] || 'the next steps'}.`;
  }

  return `Thanks for the discussion. My notes show ${actions[0] || 'a few follow-ups'}, and I will confirm owners and timing.`;
}

function attendeeSummary(attendees) {
  if (!Array.isArray(attendees) || attendees.length === 0) {
    return '';
  }

  return attendees.map((attendee) => attendee.role ? `${attendee.name} (${attendee.role})` : attendee.name).join(', ');
}

function attendeeLines(attendees) {
  if (!Array.isArray(attendees)) {
    return '';
  }

  return attendees.map((attendee) => attendee.role ? `${attendee.name}: ${attendee.role}` : attendee.name).join(', ');
}

function parseAttendees(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [name, role] = item.split(':').map((part) => part.trim());
      return { name, role: role || '' };
    })
    .filter((attendee) => attendee.name);
}

export default App;
