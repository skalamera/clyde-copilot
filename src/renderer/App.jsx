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

function parseRawTranscript(raw) {
  const turns = [];
  const lines = raw.split('\n');
  let currentSpeaker = 'Unknown';
  let currentText = [];

  for (const line of lines) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (match) {
      if (currentText.length > 0) {
        turns.push({ speaker: currentSpeaker, text: currentText.join('\n').trim() });
      }
      currentSpeaker = match[1].trim();
      currentText = [match[2].trim()];
    } else {
      currentText.push(line.trim());
    }
  }
  if (currentText.length > 0 && currentText.join('').trim() !== '') {
    turns.push({ speaker: currentSpeaker, text: currentText.join('\n').trim() });
  }
  return turns;
}

function NewOpportunityModal({ onClose, onSave }) {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [phase, setPhase] = useState('Recruiter Screen');
  const [rawText, setRawText] = useState('');

  return (
    <div className="drawer-backdrop" style={{ zIndex: 3000 }}>
      <section className="settings-drawer">
        <div className="drawer-head">
          <div>
            <h2>Add New Opportunity</h2>
            <p>Create a company/role tracker. Optionally attach an initial transcript.</p>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto' }}>
          <label>
            Company Name *
            <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Corp" />
          </label>
          <label>
            Job Title *
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Senior Engineer" />
          </label>
          
          <hr style={{ borderColor: 'var(--line)', margin: '10px 0' }} />
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Optional: Initial Transcript</p>
          
          <label>
            Phase
            <select value={phase} onChange={(e) => setPhase(e.target.value)}>
              <option value="Recruiter Screen">Recruiter Screen</option>
              <option value="Interview #1">Interview #1</option>
              <option value="Interview #2">Interview #2</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label className="wide-field">
            Transcript Text
            <textarea 
              value={rawText} 
              onChange={(e) => setRawText(e.target.value)} 
              placeholder={"Interviewer: Hello\nYou: Hi there!"} 
              style={{ minHeight: '150px' }} 
            />
          </label>
        </div>
        <div className="drawer-actions">
          <button type="button" className="primary-action" onClick={() => {
            if (!company || !role) { alert('Company and Role are required.'); return; }
            onSave({ company, role, phase, transcript: rawText ? parseRawTranscript(rawText) : [] });
          }}>
            Create Opportunity
          </button>
        </div>
      </section>
    </div>
  );
}

function JobDescriptionModal({ entity, onClose, onSave }) {
  const [jd, setJd] = useState('');
  const api = window.electronAPI;

  useEffect(() => {
    if (entity && api?.getCompanyJobDescription) {
      api.getCompanyJobDescription(entity.id).then(res => setJd(res || ''));
    }
  }, [entity, api]);

  return (
    <div className="drawer-backdrop" style={{ zIndex: 3000 }}>
      <section className="settings-drawer">
        <div className="drawer-head">
          <div>
            <h2>Job Description</h2>
            <p>For {entity?.name}</p>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <div style={{ padding: '20px' }}>
          <label className="wide-field">
            Paste Job Description
            <textarea 
              value={jd} 
              onChange={(e) => setJd(e.target.value)} 
              style={{ minHeight: '300px' }} 
            />
          </label>
        </div>
        <div className="drawer-actions">
          <button type="button" className="primary-action" onClick={() => onSave(jd)}>
            Save Job Description
          </button>
        </div>
      </section>
    </div>
  );
}

function ManualTranscriptModal({ entity, onClose, onSave }) {
  const [phase, setPhase] = useState('Interview #1');
  const [rawText, setRawText] = useState('');

  return (
    <div className="drawer-backdrop" style={{ zIndex: 3000 }}>
      <section className="settings-drawer">
        <div className="drawer-head">
          <div>
            <h2>Add Manual Transcript</h2>
            <p>For {entity?.name}</p>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <label>
            Phase
            <select value={phase} onChange={(e) => setPhase(e.target.value)}>
              <option value="Recruiter Screen">Recruiter Screen</option>
              <option value="Interview #1">Interview #1</option>
              <option value="Interview #2">Interview #2</option>
              <option value="Interview #3">Interview #3</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label className="wide-field">
            Transcript Text
            <textarea 
              value={rawText} 
              onChange={(e) => setRawText(e.target.value)} 
              placeholder={"Interviewer: Let's start...\nYou: Okay!"} 
              style={{ minHeight: '250px' }} 
            />
          </label>
        </div>
        <div className="drawer-actions">
          <button type="button" className="primary-action" onClick={() => {
            if (!rawText) return;
            onSave({ phase, transcript: parseRawTranscript(rawText) });
          }}>
            Save & Grade
          </button>
        </div>
      </section>
    </div>
  );
}

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
  const [newOpportunityOpen, setNewOpportunityOpen] = useState(false);
  const [jdModalOpen, setJdModalOpen] = useState(false);
  const [jdTargetEntity, setJdTargetEntity] = useState(null);
  const [manualTranscriptOpen, setManualTranscriptOpen] = useState(false);
  const [manualTargetEntity, setManualTargetEntity] = useState(null);

  useEffect(() => {
    const handleJd = (e) => {
      setJdTargetEntity(e.detail);
      setJdModalOpen(true);
    };
    const handleManual = (e) => {
      setManualTargetEntity(e.detail);
      setManualTranscriptOpen(true);
    };
    window.addEventListener('open-jd-modal', handleJd);
    window.addEventListener('open-manual-transcript-modal', handleManual);
    return () => {
      window.removeEventListener('open-jd-modal', handleJd);
      window.removeEventListener('open-manual-transcript-modal', handleManual);
    };
  }, []);

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
        entities={entities}
        mode={mode}
        onModeChange={chooseMode}
        onSettings={() => setSettingsOpen(true)}
        settings={settings}
        onAddNewOpportunity={() => setNewOpportunityOpen(true)}
        onChangeActiveInterview={async (company, role) => {
          const nextSettings = await api?.setActiveSessionContext?.({
            mode,
            company,
            role
          });
          if (nextSettings) {
            setSettings(nextSettings);
          }
        }}
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
            onAddNewOpportunity={() => setNewOpportunityOpen(true)}
            onSelectEntity={async (entityId) => {
              setSelectedEntity(entityId);
              const nextSessions = await api?.getSessions?.({ mode, entityId });
              setSessions(nextSessions || []);
            }}
            settings={settings}
            onChangeActiveInterview={async (company, role) => {
              const nextSettings = await api?.setActiveSessionContext?.({
                mode,
                company,
                role
              });
              if (nextSettings) {
                setSettings(nextSettings);
              }
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

        {newOpportunityOpen && (
          <NewOpportunityModal 
            onClose={() => setNewOpportunityOpen(false)} 
            onSave={async (data) => {
              if (data.transcript && data.transcript.length > 0) {
                await api?.saveSession?.({
                  mode: 'interview',
                  entity: { id: data.company, name: data.company, role: data.role },
                  title: data.phase,
                  phase: data.phase,
                  transcript: data.transcript,
                  grading: { status: 'pending' }
                });
              } else {
                await api?.saveSession?.({
                  mode: 'interview',
                  entity: { id: data.company, name: data.company, role: data.role },
                  title: 'Opportunity created',
                  transcript: []
                });
              }
              setNewOpportunityOpen(false);
              reloadSessions('interview');
            }} 
          />
        )}

        {jdModalOpen && (
          <JobDescriptionModal
            entity={jdTargetEntity}
            onClose={() => setJdModalOpen(false)}
            onSave={async (jdText) => {
              let finalJd = jdText;
              if (jdText && jdText.length > 50) {
                try {
                  const extracted = await api?.extractJobContext?.(jdText);
                  if (extracted && extracted.structured_description) {
                    finalJd = extracted.structured_description;
                  }
                } catch(e) {}
              }
              await api?.setCompanyJobDescription?.(jdTargetEntity.id, finalJd);
              setJdModalOpen(false);
              reloadSessions('interview', jdTargetEntity.id); // Refresh so timeline button updates
            }}
          />
        )}

        {manualTranscriptOpen && (
          <ManualTranscriptModal
            entity={manualTargetEntity}
            onClose={() => setManualTranscriptOpen(false)}
            onSave={async (data) => {
              await api?.saveSession?.({
                mode: 'interview',
                entity: manualTargetEntity,
                title: data.phase,
                phase: data.phase,
                transcript: data.transcript,
                grading: { status: 'pending' }
              });
              setManualTranscriptOpen(false);
              reloadSessions('interview', manualTargetEntity.id);
            }}
          />
        )}
    </div>
  );
}

function TitleBar({ entities, mode, onModeChange, onSettings, settings, onChangeActiveInterview, onAddNewOpportunity }) {
  const isInterview = mode === 'interview';

  return (
    <header className="title-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <div className="window-dots" aria-hidden="true" style={{ position: 'relative', top: 0, left: 0 }}>
          <span />
          <span />
          <span />
        </div>
        
        {isInterview && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', WebkitAppRegion: 'no-drag' }}>
            <span style={{ color: 'var(--muted)' }}>Active Interview:</span>
            <select 
              value={settings.currentCompany || ''} 
              onChange={(e) => {
                if (e.target.value === '__new__') {
                  onAddNewOpportunity();
                } else {
                  const entity = entities.find(ent => ent.id === e.target.value);
                  onChangeActiveInterview(e.target.value, entity?.role || '');
                }
              }}
              style={{ 
                background: 'rgba(255,255,255,0.05)', 
                border: '1px solid var(--line)', 
                color: 'var(--text)', 
                padding: '4px 8px', 
                borderRadius: '4px',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="">None</option>
              {entities.map(ent => (
                <option key={ent.id} value={ent.id}>
                  {ent.name}{ent.role ? ` - ${ent.role}` : ''}
                </option>
              ))}
              <option value="__new__">+ Add New</option>
            </select>
          </div>
        )}
      </div>

      <div className="title-center" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', WebkitAppRegion: 'no-drag' }}>
        <ModeToggle mode={mode} onChange={onModeChange} />
      </div>

      <div className="title-actions" style={{ WebkitAppRegion: 'no-drag' }}>
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

function TimelineView({ entities, mode, onRefresh, onAddNewOpportunity, onSelectEntity, selectedEntity, sessions, settings, onChangeActiveInterview }) {
  const selected = entities.find((entity) => entity.id === selectedEntity);
  const [hasJd, setHasJd] = useState(false);
  const api = window.electronAPI;

  useEffect(() => {
    if (selected && api?.getCompanyJobDescription) {
      api.getCompanyJobDescription(selected.id).then(res => setHasJd(!!(res && res.trim().length > 0)));
    }
  }, [selected, api]);

  const handleDeleteEntity = async () => {
    if (confirm(`Delete "${selected.name}" and all its transcripts? This cannot be undone.`)) {
      if (mode === 'interview') {
        await api?.deleteCompany?.(selected.id);
        
        // If this was the active interview, clear it
        if (settings?.currentCompany === selected.id) {
            await onChangeActiveInterview('', '');
        }
      }
      onSelectEntity(''); // clear selected entity
      onRefresh(); // Refresh the sidebar list
    }
  };

  const handleDeleteSession = async (session) => {
    if (confirm(`Delete this session?`)) {
      await api?.deleteSession?.({ mode: session.mode, id: session.id, entityId: session.entity.id });
      onSelectEntity(selected.id); // Refresh sessions for this entity
    }
  };

  return (
    <section className="timeline-view" data-testid="sessionTimeline">
      <div className="timeline-rail">
        <div className="timeline-heading">
          <h2>{mode === 'interview' ? 'Interview timeline' : 'Meeting memory'}</h2>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            {mode === 'interview' && (
              <button type="button" onClick={onAddNewOpportunity} className="primary-action" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                + Add New Opportunity
              </button>
            )}
            <button type="button" onClick={onRefresh} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Refresh</button>
          </div>
        </div>
        <div className="entity-list">
          {entities.length ? entities.map((entity) => {
            const isActive = mode === 'interview' && settings?.currentCompany === entity.id;
            return (
              <div key={entity.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  className={entity.id === selectedEntity ? 'active' : ''}
                  type="button"
                  onClick={() => onSelectEntity(entity.id)}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <strong>{entity.name}</strong>
                    {mode === 'interview' && entity.confidence > 0 && (
                      <span style={{ 
                        fontSize: '0.75rem', 
                        padding: '2px 6px', 
                        borderRadius: '12px', 
                        background: 'rgba(0,0,0,0.3)',
                        color: entity.confidence > 70 ? 'var(--success)' : (entity.confidence > 40 ? 'var(--warning)' : 'var(--danger)')
                      }}>
                        {entity.confidence}%
                      </span>
                    )}
                  </div>
                  <span>{entity.role || entity.kind}</span>
                </button>
                {mode === 'interview' && (
                  <button 
                    type="button" 
                    title={isActive ? "Active Interview" : "Set as Active Interview"}
                    onClick={() => onChangeActiveInterview(entity.id, entity.role)}
                    style={{ 
                      padding: '4px 8px', 
                      background: isActive ? 'var(--cyan)' : 'transparent',
                      color: isActive ? '#000' : 'var(--muted)',
                      border: '1px solid var(--line)',
                      borderRadius: '4px'
                    }}
                  >
                    {isActive ? '★' : '☆'}
                  </button>
                )}
              </div>
            );
          }) : <EmptyState title="No saved sessions" body="Save a session to build history." />}
        </div>
      </div>

      <div className="timeline-main">
        <div className="timeline-title">
          <div>
            <h2>{selected?.name || 'Select a record'}</h2>
            <p>{sessions.length} saved sessions</p>
          </div>
          {selected && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button type="button" onClick={handleDeleteEntity} style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer' }} title="Delete Entity">
                🗑️
              </button>
              {mode === 'interview' && (
                <>
              <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-jd-modal', { detail: selected }))}>
                {hasJd ? 'View Job Description' : 'Attach Job Description'}
              </button>
                  <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-manual-transcript-modal', { detail: selected }))}>
                    + Add Manual Transcript
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <div className="session-list">
          {sessions.length ? sessions.map((session) => (
            <SessionBlock key={`${session.mode}-${session.entity.id}-${session.id}`} session={session} onDelete={() => handleDeleteSession(session)} />
          )) : <EmptyState title="No sessions selected" body="Choose a company or meeting from the rail." />}
        </div>
      </div>
    </section>
  );
}

function SessionBlock({ session, onDelete }) {
  return (
    <article className="session-block">
      <div className="session-head">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3>{session.title}</h3>
            {onDelete && (
              <button type="button" onClick={onDelete} style={{ padding: '2px 6px', fontSize: '0.8rem', background: 'transparent', border: 'none', cursor: 'pointer' }} title="Delete Session">
                🗑️
              </button>
            )}
          </div>
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
  const [activeTab, setActiveTab] = useState('context');

  useEffect(() => {
    setDraft({
      ...settings,
      meetingAttendeesText: attendeeLines(settings.meetingAttendees)
    });
  }, [settings]);

  function update(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function renderLlmModelOptions() {
    const provider = draft.llmProvider || 'local';
    let options = [];
    if (provider === 'openai') {
      options = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini', 'o3-mini'];
    } else if (provider === 'anthropic') {
      options = ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'];
    } else if (provider === 'gemini') {
      options = ['gemini-3.1-flash-lite', 'gemini-3.1-pro-preview', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    }
    return options.map(opt => <option key={opt} value={opt} />);
  }

  return (
    <form className={`settings-form ${compact ? 'compact' : ''}`} onSubmit={(event) => {
      event.preventDefault();
      onSave(draft);
    }}>
      <div className="tabs" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <button type="button" className={activeTab === 'context' ? 'active' : ''} onClick={() => setActiveTab('context')}>Context</button>
        <button type="button" className={activeTab === 'llm' ? 'active' : ''} onClick={() => setActiveTab('llm')}>LLM</button>
        <button type="button" className={activeTab === 'transcription' ? 'active' : ''} onClick={() => setActiveTab('transcription')}>Speech</button>
      </div>

      {activeTab === 'context' && (
        <>
          <div className="form-grid">
            {mode === 'meeting' && (
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
          </div>
          <label className="wide-field" style={{ marginTop: mode === 'meeting' ? '0' : '15px' }}>
            {mode === 'interview' ? 'Resume / background' : 'Meeting memory'}
            <textarea
              style={{ minHeight: '120px' }}
              value={mode === 'interview' ? (draft.resumeText || '') : (draft.meetingMemory || '')}
              onChange={(event) => update(mode === 'interview' ? 'resumeText' : 'meetingMemory', event.target.value)}
              placeholder={mode === 'interview' ? 'Paste resume facts, metrics, and projects.' : 'Paste prior notes, person context, or recurring meeting memory.'}
            />
          </label>
          <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid var(--line)' }}>
            <label className="toggle-row" style={{ marginBottom: draft.ragEnabled ? '10px' : '0' }}>
              <input
                type="checkbox"
                checked={Boolean(draft.ragEnabled)}
                onChange={(event) => update('ragEnabled', event.target.checked)}
              />
              Enable Advanced RAG (Pinecone)
            </label>
            {draft.ragEnabled && (
              <div className="form-grid">
                <label>
                  Pinecone API Key
                  <input autoComplete="new-password" type="password" value={draft.pineconeApiKey || ''} onChange={(event) => update('pineconeApiKey', event.target.value)} placeholder="Stored locally" />
                </label>
                <label>
                  Pinecone Host URL
                  <input value={draft.pineconeHost || ''} onChange={(event) => update('pineconeHost', event.target.value)} placeholder="e.g. https://index.pinecone.io" />
                </label>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'llm' && (
        <div className="form-grid">
          <label>
            LLM provider
            <select value={draft.llmProvider || 'local'} onChange={(event) => {
              update('llmProvider', event.target.value);
              // auto-default model
              if (event.target.value === 'openai') update('llmModel', 'gpt-4o');
              if (event.target.value === 'anthropic') update('llmModel', 'claude-3-7-sonnet-20250219');
              if (event.target.value === 'gemini') update('llmModel', 'gemini-3.1-flash-lite');
              if (event.target.value === 'local') update('llmModel', '');
            }}>
              <option value="local">Local LM Studio</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="gemini">Google Gemini</option>
            </select>
          </label>
          <label>
            Model
            <input list="llmModelList" value={draft.llmModel || ''} onChange={(event) => update('llmModel', event.target.value)} placeholder="Model identifier" />
            <datalist id="llmModelList">{renderLlmModelOptions()}</datalist>
          </label>
          {draft.llmProvider !== 'local' && (
            <label>
              API key
              <input autoComplete="new-password" type="password" value={draft.llmApiKey || ''} onChange={(event) => update('llmApiKey', event.target.value)} placeholder="Stored locally" />
            </label>
          )}
          {draft.llmProvider === 'local' && (
            <label>
              Local LLM URL
              <input value={draft.localLlmUrl || ''} onChange={(event) => update('localLlmUrl', event.target.value)} placeholder="http://localhost:1234/v1/chat/completions" />
            </label>
          )}
        </div>
      )}

      {activeTab === 'transcription' && (
        <div className="form-grid">
          <label>
            Transcription provider
            <select value={draft.transcriptionProvider || 'local'} onChange={(event) => update('transcriptionProvider', event.target.value)}>
              <option value="local">Local Whisper</option>
              <option value="openai">OpenAI Whisper</option>
            </select>
          </label>
          {draft.transcriptionProvider === 'local' ? (
            <label>
              Transcription URL
              <input value={draft.localTranscriptionUrl || ''} onChange={(event) => update('localTranscriptionUrl', event.target.value)} placeholder="http://localhost:8000/v1/audio/transcriptions" />
            </label>
          ) : (
            <label>
              OpenAI API Key
              <input autoComplete="new-password" type="password" value={draft.transcriptionApiKey || ''} onChange={(event) => update('transcriptionApiKey', event.target.value)} placeholder="Stored locally" />
            </label>
          )}
        </div>
      )}

      <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={Boolean(draft.screenShareHidden)}
            onChange={(event) => update('screenShareHidden', event.target.checked)}
          />
          Screen-share safe overlay state
        </label>
        <button type="submit" className="primary-action">Save setup</button>
      </div>
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
