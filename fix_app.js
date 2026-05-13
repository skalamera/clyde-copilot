const fs = require('fs');
let code = fs.readFileSync('src/renderer/App.jsx', 'utf8');

// 1. Add parsing helper and Modals at the top (after imports)
const modalsCode = `
function parseRawTranscript(raw) {
  const turns = [];
  const lines = raw.split('\\n');
  let currentSpeaker = 'Unknown';
  let currentText = [];

  for (const line of lines) {
    const match = line.match(/^([^:]+):\\s*(.*)$/);
    if (match) {
      if (currentText.length > 0) {
        turns.push({ speaker: currentSpeaker, text: currentText.join('\\n').trim() });
      }
      currentSpeaker = match[1].trim();
      currentText = [match[2].trim()];
    } else {
      currentText.push(line.trim());
    }
  }
  if (currentText.length > 0 && currentText.join('').trim() !== '') {
    turns.push({ speaker: currentSpeaker, text: currentText.join('\\n').trim() });
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
              placeholder="Interviewer: Hello\\nYou: Hi there!" 
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
  }, [entity]);

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
              placeholder="Interviewer: Let's start...\\nYou: Okay!" 
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

`;

if (!code.includes('function parseRawTranscript')) {
  code = code.replace(/function App\(\) \{/, modalsCode + 'function App() {\n');
}

// 2. Add App state
code = code.replace(/const \[serviceChecking, setServiceChecking\] = useState\(false\);/, `const [serviceChecking, setServiceChecking] = useState(false);
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
  }, []);`);

// 3. App TitleBar
code = code.replace(/<TitleBar[\s\S]*?\/>/, `<TitleBar
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
      />`);

// 4. App TimelineView
code = code.replace(/<TimelineView[\s\S]*?\/>/, `<TimelineView
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
          />`);

// 5. App Render Modals
code = code.replace(/\{settingsOpen \? \([\s\S]*?\) : null\}/, `{settingsOpen ? (
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
        )}`);

// 6. TitleBar Component Signature & JSX
code = code.replace(/function TitleBar\(\{[^\}]*\}\) \{/, `function TitleBar({ entities, mode, onModeChange, onSettings, settings, onChangeActiveInterview, onAddNewOpportunity }) {
  const isInterview = mode === 'interview';`);

code = code.replace(/<div className="title-center">/, `{isInterview && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '20px', fontSize: '0.85rem' }}>
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
              padding: '2px 8px', 
              borderRadius: '4px' 
            }}
          >
            <option value="">None</option>
            {entities.map(ent => (
              <option key={ent.id} value={ent.id}>
                {ent.name}{ent.role ? \` - \${ent.role}\` : ''}
              </option>
            ))}
            <option value="__new__">+ Add New</option>
          </select>
        </div>
      )}
      <div className="title-center">`);

// 7. TimelineView Signature & Body
code = code.replace(/function TimelineView\(\{[^\}]*\}\) \{/, `function TimelineView({ entities, mode, onRefresh, onAddNewOpportunity, onSelectEntity, selectedEntity, sessions, settings, onChangeActiveInterview }) {`);

code = code.replace(/<div className="timeline-heading">[\s\S]*?<\/div>/, `<div className="timeline-heading">
          <h2>{mode === 'interview' ? 'Interview timeline' : 'Meeting memory'}</h2>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            {mode === 'interview' && (
              <button type="button" onClick={onAddNewOpportunity} className="primary-action" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                + Add New Opportunity
              </button>
            )}
            <button type="button" onClick={onRefresh} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Refresh</button>
          </div>
        </div>`);

code = code.replace(/\{entities\.length \? entities\.map\(\(entity\) => \([\s\S]*?\)\) : <EmptyState/g, `{entities.length ? entities.map((entity) => {
            const isActive = mode === 'interview' && settings?.currentCompany === entity.id;
            return (
              <div key={entity.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  className={entity.id === selectedEntity ? 'active' : ''}
                  type="button"
                  onClick={() => onSelectEntity(entity.id)}
                  style={{ flex: 1 }}
                >
                  <strong>{entity.name}</strong>
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
          }) : <EmptyState`);

code = code.replace(/<p>\{sessions\.length\} saved sessions<\/p>[\s\S]*?<\/div>[\s\S]*?<\/div>/, `<p>{sessions.length} saved sessions</p>
          </div>
          {mode === 'interview' && selected && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-jd-modal', { detail: selected }))}>
                Attach Job Description
              </button>
              <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-manual-transcript-modal', { detail: selected }))}>
                + Add Manual Transcript
              </button>
            </div>
          )}
        </div>`);

// 8. SetupFields signature and implementation
code = code.replace(/function SetupFields\(\{ compact = false, mode, onSave, settings \}\) \{[\s\S]*?return \([\s\S]*?<\/form>/, `function SetupFields({ compact = false, mode, onSave, settings }) {
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
    <form className={\`settings-form \${compact ? 'compact' : ''}\`} onSubmit={(event) => {
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
    </form>`);

fs.writeFileSync('src/renderer/App.jsx', code);
