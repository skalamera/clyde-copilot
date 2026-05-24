import { useEffect, useMemo, useRef, useState } from 'react';
import { LiveAvatarSession, SessionEvent } from '@heygen/liveavatar-web-sdk';

const downloadHref = '/downloads/clyde-windows.exe';

const tiers = [
  {
    name: 'Free',
    icon: '/clyde-free-coin.svg',
    logo: '/clyde-plus-ghost-free.svg',
    body: 'Start with Clyde Assistant: floating chat, active-context questions, local knowledge/basic context, meeting notes, and private/local operation options.'
  },
  {
    name: 'Pro',
    icon: '/clyde_pro_coin_dirty_black_gold.svg',
    logo: '/clyde-plus-ghost-pro.svg',
    body: 'Unlock Clyde Pro Agent: RAG across knowledge and sessions, broader memory, Gmail and Calendar scanning, autonomous updates, mock interview scorecards, and outcome-calibrated trends.'
  }
];

const featureTabs = [
  {
    id: 'live',
    label: 'Live assistant',
    title: 'A private assistant beside you while the meeting is still live.',
    body: 'Free users get active-context help and local/basic knowledge. Pro users unlock the full agentic layer with deeper memory, RAG, and follow-through.',
    bullets: ['Undetectable desktop overlay', 'Active-context questions', 'Pro answer cards and RAG'],
    stat: '<2s'
  },
  {
    id: 'interviews',
    label: 'Opportunity memory',
    title: 'Every person, company, role, and round gets memory.',
    body: 'Clyde Assistant focuses on the current opportunity or meeting. Clyde Pro Agent expands to broader cross-opportunity and cross-meeting memory.',
    bullets: ['Free active context', 'Pro cross-session memory', 'Company and contact recall'],
    stat: 'RAG'
  },
  {
    id: 'learning',
    label: 'Outcome learning',
    title: 'Your real outcomes make future scores more honest.',
    body: 'Clyde analyzes every transcript, phase, scorecard, and result so confidence scores become grounded in what actually happened across your interview history.',
    bullets: ['0-100 session scorecards', 'Phase-by-phase trend analysis', 'Confidence calibrated by outcomes'],
    stat: '0-100'
  }
];

const comparisonRows = [
  ['Undetectable mode', 'Often joins as a visible attendee', 'Desktop assistant stays outside the guest list and hides from standard captures where supported'],
  ['Private or frontier AI', 'Cloud-only processing', 'Run 100% locally or mix frontier transcription and LLM providers when you choose'],
  ['Agentic opportunity updates', 'Manual CRM upkeep', 'Pro Agent Gmail and Google Calendar scans can suggest or complete status, event, and next-step updates'],
  ['Interview-specific memory', 'Generic notes after the call', 'Company, person, role, JD, phase, transcript rating, and confidence live together'],
  ['Outcome-labeled learning', 'One-off transcript summaries', 'Advanced, rejected, and offer outcomes calibrate future grading'],
  ['Screenshot-aware answers', 'Audio-only context', 'Ask about the screen, transcript, resume, job description, RAG sources, or memory']
];

const faqs = [
  {
    question: 'Does Clyde join my meeting?',
    answer: 'No. Clyde runs as a desktop app on your machine, so it does not appear as a meeting participant or bot. In undetectable mode, the HUD is designed to stay out of standard screen shares where supported.'
  },
  {
    question: 'What does Capture Protection do?',
    answer: 'It uses Electron content protection and overlay behavior to keep the active Clyde HUD out of standard screen sharing or recording paths where the operating system and meeting app support it.'
  },
  {
    question: 'Can Clyde run fully privately?',
    answer: 'Yes. If you choose the local path, no transcript, audio, or prompt text has to leave your device. You can also opt into frontier realtime transcription or cloud LLM providers when performance matters more than full locality.'
  },
  {
    question: 'Can I use different providers for transcription and chat?',
    answer: 'Yes. Clyde is designed for mix-and-match providers, so you can use one model for the standard assistant and another provider for realtime transcription.'
  },
  {
    question: 'How does Clyde learn from outcomes?',
    answer: 'You label opportunities as advanced, rejected, or offer. Clyde compares future transcripts against those prior outcomes, then adjusts scorecards, trend analysis, and confidence scoring.'
  }
];

const howSteps = [
  {
    title: 'Audio capture',
    body: 'Clyde captures microphone and system audio separately, labels speakers as you and others, and creates a near realtime transcript.'
  },
  {
    title: 'Model routing',
    body: 'Use fully local transcription and chat, or mix providers so one model powers the assistant while another handles realtime transcription.'
  },
  {
    title: 'Context pack',
    body: 'Clyde Assistant can read recent transcript, active opportunity, resume notes, job description, and basic/local context. Pro adds RAG, broader memory, and screenshots.'
  },
  {
    title: 'Answer cards',
    body: 'Clyde returns short cards for what to say next, follow-up questions, recap points, risks, and screen-specific help.'
  },
  {
    title: 'Agentic updates',
    body: 'Gmail and Calendar scans can suggest or complete opportunity status updates, meeting invites, reminders, and next actions.'
  },
  {
    title: 'Post-call analysis',
    body: 'Every meeting receives notes and action items. Interviews also get a 0-100 rating, confidence score, and trend analysis.'
  },
  {
    title: 'Outcome calibration',
    body: 'After real outcomes arrive, Clyde compares new sessions against rejected, advanced, and offer examples to improve future confidence scores.'
  }
];

const agentLifecycle = [
  {
    phase: 'Before',
    title: 'Pre-call intelligence pack',
    body: 'Free active context assembles the current role, company, meeting, and saved basics. Pro adds prior sessions, meeting history, saved files, and pinned RAG sources before the call starts.',
    points: ['Role-specific prep', 'Past-round recall', 'Questions to ask']
  },
  {
    phase: 'During',
    title: 'Realtime meeting copilot',
    body: 'While the call is live, Clyde listens privately, watches for questions, analyzes screenshots, and produces concise cards for answers, risks, follow-ups, and recap points.',
    points: ['Near realtime transcript', 'Transparent answer cards', 'Screenshot-aware help']
  },
  {
    phase: 'After',
    title: 'Post-call analyst',
    body: 'When the meeting ends, Clyde saves the transcript, writes notes, extracts action items, scores interviews, updates confidence, and makes the session searchable from chat.',
    points: ['Meeting notes', '0-100 scorecards', 'Searchable memory']
  },
  {
    phase: 'Background',
    title: 'Opportunity operations agent',
    body: 'Clyde can scan Gmail and Google Calendar for interview invites, status updates, offers, rejections, and next steps, then suggest or complete app actions.',
    points: ['Calendar updates', 'Status changes', 'Approval or autonomy']
  }
];

const agenticCapabilities = [
  ['Observe', 'Tracks live transcript turns, selected sources, screenshots, upcoming events, inbox signals, and current opportunity state.'],
  ['Reason', 'Combines active context with Pro RAG, prior outcomes, meeting memory, and the current question to decide what is useful right now.'],
  ['Act', 'Drafts answers, creates follow-ups, proposes calendar events, updates opportunity statuses, and saves knowledge back into Clyde.'],
  ['Learn', 'Uses real outcomes and session ratings to make future prep, scorecards, trend analysis, and confidence estimates more realistic.']
];

function App() {
  const [path, setPath] = useState(() => normalizePath(window.location.pathname));
  const [downloadOpen, setDownloadOpen] = useState(false);

  useEffect(() => {
    const handlePop = () => setPath(normalizePath(window.location.pathname));
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--mx', '50%');
    document.documentElement.style.setProperty('--my', '20%');
    const handlePointer = (event) => {
      document.documentElement.style.setProperty('--mx', `${event.clientX}px`);
      document.documentElement.style.setProperty('--my', `${event.clientY}px`);
    };
    window.addEventListener('pointermove', handlePointer, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointer);
  }, []);

  useEffect(() => {
    const items = Array.from(document.querySelectorAll('[data-reveal]'));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('is-visible');
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    );
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [path]);

  function navigate(nextPath) {
    const cleanPath = normalizePath(nextPath);
    if (cleanPath !== path) {
      window.history.pushState({}, '', cleanPath);
      setPath(cleanPath);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function handleDownload(event) {
    setDownloadOpen(false);
  }

  const currentPage = path === '/how-it-works'
    ? <HowItWorksPage onDownload={handleDownload} />
    : <LandingPage onDownload={handleDownload} navigate={navigate} />;

  return (
    <div className="site-shell">
      <AnimatedBackdrop />
      <Header path={path} navigate={navigate} onDownload={handleDownload} />
      {currentPage}
      <Footer navigate={navigate} onDownload={handleDownload} />
      {downloadOpen ? <DownloadModal onClose={() => setDownloadOpen(false)} /> : null}
    </div>
  );
}

function Header({ navigate, onDownload, path }) {
  return (
    <header className="site-header">
      <button className="brand-link" type="button" onClick={() => navigate('/')}>
        <img src="/clyde-free-logo-textonly.svg" alt="Clyde" />
      </button>
      <nav aria-label="Primary navigation">
        <button type="button" onClick={() => navigate('/')} className={path === '/' ? 'active' : ''}>Home</button>
        <button type="button" onClick={() => navigate('/how-it-works')} className={path === '/how-it-works' ? 'active' : ''}>How it works</button>
        <a href="#privacy">Privacy</a>
        <a href="#faq">FAQ</a>
      </nav>
      <a className="header-cta" href={downloadHref} onClick={onDownload} download>Download for Windows</a>
    </header>
  );
}

function LandingPage({ navigate, onDownload }) {
  return (
    <main>
      <section className="hero-section">
        <HeroScene />
        <div className="hero-copy" data-reveal>
          <div className="hero-logo-lockup"><img src="/clyde-plus-ghost-free.svg" alt="Clyde" /></div>
          <h1>The Undetectable Agentic Partner.</h1>
          <p>
            Elevating professional execution with private, autonomous intelligence and real-time mastery.
          </p>
          <p className="release-note">Free includes Clyde Assistant. Pro unlocks Clyde Pro Agent for RAG, broader memory, Google sync, autonomous updates, and deeper interview intelligence. Pro is free during beta.</p>
          <div className="hero-actions">
            <a className="primary-link" href={downloadHref} onClick={onDownload} download>Download for Windows</a>
            <button className="secondary-link" type="button" onClick={() => navigate('/how-it-works')}>See how it works</button>
          </div>
        </div>
        <div className="scroll-cue" aria-hidden="true">
          <span />
        </div>
      </section>

      <FullOverlayShowcase />

      <section className="section-band product-band" data-reveal>
        <div className="section-heading">
          <h2>Not a notetaker. A meeting and opportunity agent.</h2>
          <p>Clyde works across the full lifecycle: pre-call prep, live assistance, post-call analysis, and background follow-through.</p>
        </div>
        <FeatureTabs />
      </section>

      <MockInterviewSection />

      <MockScorecardShowcase />

      <section className="section-band workflow-band" data-reveal>
        <div className="section-heading compact">
          <h2>Clyde Assistant for everyone. Clyde Pro Agent when you need more.</h2>
          <p>Free users get focused active-context help. Pro users unlock deeper memory, RAG, Google sync, autonomous actions, and advanced interview intelligence.</p>
        </div>
        <div className="workflow-grid">
          <WorkflowCard number="Free" title="Clyde Assistant" body="Floating chat, active-context questions, local knowledge/basic context, current opportunities or meetings, simple supported actions, and private/local operation options." />
          <WorkflowCard number="Pro" title="Clyde Pro Agent" body="RAG across knowledge and sessions, cross-opportunity memory, Google scans, sync proposals, autonomous updates, mock scorecards, calibrated trends, and agentic follow-through." />
          <WorkflowCard number="Both" title="Same simple chat surface" body="Ask Clyde from the floating widget. The tier determines how much context Clyde can access, how broadly it can reason, and which actions it can prepare or complete." />
        </div>
        <AssistantAgentShowcase />
      </section>

        <TierSection />

      <section className="section-band workflow-band" data-reveal>
        <div className="section-heading compact">
          <h2>From live question to confident answer in seconds.</h2>
          <p>Ask about the transcript, screen, job description, active context, or Pro RAG sources when you need broader memory.</p>
        </div>
        <div className="workflow-grid">
          <WorkflowCard number="01" title="Listen" body="Clyde captures microphone and system audio, then builds a speaker-aware near realtime transcript." />
          <WorkflowCard number="02" title="Think with context" body="Clyde Assistant reads active context and basic/local knowledge. Clyde Pro Agent adds broader memory, saved sessions, RAG, and connected signals." />
          <WorkflowCard number="03" title="Act" body="Clyde can suggest or complete next steps: answer cards, follow-ups, opportunity updates, calendar events, and post-call action items." />
        </div>
      </section>

      <section className="section-band privacy-band" id="privacy" data-reveal>
        <div className="privacy-copy">
          <h2>Undetectable when you need it. Fully private when you choose it.</h2>
          <p>
            Clyde runs on your desktop and does not join meetings as a bot. Use Capture Protection for standard screen-share privacy where supported,
            or route transcription and AI locally so audio, transcript, and text never leave your device.
          </p>
          <button type="button" className="secondary-link" onClick={() => navigate('/how-it-works')}>Read the technical flow</button>
        </div>
        <PrivacyVisual />
      </section>

      <section className="section-band learning-band" data-reveal>
        <div className="section-heading">
          <h2>Clyde trains you into a stronger interviewer over time.</h2>
          <p>Every transcript, meeting note, scorecard, and opportunity outcome becomes feedback for the next round.</p>
        </div>
        <LearningLoop />
      </section>

      <TrendShowcase />

      <section className="section-band comparison-band" data-reveal>
        <div className="section-heading">
          <h2>Why Clyde is different from standard AI notetakers.</h2>
          <p>Most tools summarize the past. Clyde prepares for what is next, helps in the moment, and moves the opportunity forward.</p>
        </div>
        <ComparisonTable />
      </section>

      <HomeScreenFeature />

      <section className="section-band proof-band" data-reveal>
        <div className="section-heading compact">
          <h2>Everything you need after the call is already organized.</h2>
          <p>Use Clyde Assistant for active-context questions. Upgrade to Clyde Pro Agent to search broadly across notes, transcripts, action items, scorecards, and old meetings.</p>
        </div>
        <PlaceholderWall />
      </section>

      <FaqSection />
      <FinalCta onDownload={onDownload} />
    </main>
  );
}

function HowItWorksPage({ onDownload }) {
  return (
    <main>
      <section className="subpage-hero">
        <div className="subpage-copy" data-reveal>
          <h1>How Clyde listens, protects privacy, acts, and learns.</h1>
          <p>
            Clyde combines live capture, local or cloud model routing, active context, agentic app updates, and outcome calibration
            so the feedback gets closer to your real interview market over time.
          </p>
        </div>
        <ArchitectureVisual />
      </section>

      <section className="section-band steps-band" data-reveal>
        <div className="section-heading">
          <h2>The call flow.</h2>
          <p>Each step maps to a real Clyde subsystem in the desktop app, from undetectable live help to post-call analysis.</p>
        </div>
        <div className="steps-grid">
          {howSteps.map((step, index) => (
            <article className="step-card" key={step.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-band agent-lifecycle-band" data-reveal>
        <div className="section-heading">
          <h2>The Pro Agent lifecycle.</h2>
          <p>Clyde Assistant handles focused active-context help. Clyde Pro Agent observes, reasons, acts, and learns across the entire meeting and opportunity workflow.</p>
        </div>
        <div className="agent-lifecycle-grid">
          {agentLifecycle.map((item) => (
            <article className="agent-lifecycle-card" key={item.phase}>
              <span>{item.phase}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <div>
                {item.points.map((point) => <em key={point}>{point}</em>)}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-band agent-brain-band" data-reveal>
        <div className="agent-brain-visual" aria-hidden="true">
          <div className="brain-core">
            <img src="/clydefree.svg" alt="" />
            <strong>Clyde Pro Agent</strong>
          </div>
          {agenticCapabilities.map(([label], index) => (
            <div className={`orbit-node orbit-${index + 1}`} key={label}>{label}</div>
          ))}
        </div>
        <div className="agent-brain-copy">
          <span className="eyebrow">Pro Agent architecture</span>
          <h2>Context in. Action out.</h2>
          <p>
            Clyde Assistant focuses on active context. Clyde Pro Agent expands the reasoning loop to saved sessions, RAG, screenshots, calendar events, Gmail signals, and outcomes.
            You choose whether Pro actions require approval or run autonomously inside Clyde.
          </p>
          <div className="agent-capability-list">
            {agenticCapabilities.map(([label, body]) => (
              <div key={label}>
                <strong>{label}</strong>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-band technical-band" data-reveal>
        <div className="technical-panel">
          <h2>Screen-share privacy details.</h2>
          <p>
            Clyde’s Capture Protection can call Electron content protection and keep its active capture window in an overlay mode.
            This is meant to keep Clyde out of common shared-screen and recording surfaces where the OS supports that behavior.
          </p>
        </div>
        <div className="technical-panel accent">
          <h2>Local-first or frontier-model data path.</h2>
          <p>
            Audio can go to local transcription and answers can come from a local LLM, so no transcript, audio, or text leaves your device.
            You can also mix providers and use the latest realtime transcription models when you choose.
          </p>
          <p>
            Source toggles let you choose which context Clyde reads during a call. Free focuses on active context and basic/local knowledge. Pro adds RAG, broader memory, Google sync, and advanced source selection.
          </p>
        </div>
      </section>

      <section className="section-band context-routing-band" data-reveal>
        <div className="section-heading compact">
          <h2>Source routing keeps Clyde precise.</h2>
          <p>Active context keeps Free focused and private. Pro source routing unlocks broader RAG, cross-session memory, Google signals, and agentic follow-through.</p>
        </div>
        <div className="context-routing-grid">
          <div className="routing-stack">
            <span>Live transcript</span>
            <span>Screenshot</span>
            <span>Resume + files</span>
            <span>Pro RAG knowledge</span>
            <span>Pro Calendar + Gmail</span>
            <span>Pro past outcomes</span>
          </div>
          <div className="routing-output">
            <h3>Active context pack</h3>
            <p>Compressed, relevant context for the exact person, company, role, or meeting you are in.</p>
            <ul>
              <li>Answer suggestions stay specific to the moment.</li>
              <li>Mock interviews ask questions for the active role.</li>
              <li>Post-call notes and actions land in the right opportunity.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section-band learning-detail-band" data-reveal>
        <div className="section-heading">
          <h2>How confidence gets more realistic.</h2>
          <p>Clyde compares future sessions against your prior transcripts, ratings, phases, and real outcomes.</p>
        </div>
        <div className="learning-detail">
          <div className="timeline-strip">
            <span>Interview 1</span>
            <span>Advanced</span>
            <span>Interview 2</span>
            <span>Rejected</span>
            <span>Next prep</span>
          </div>
          <div className="learning-detail-copy">
            <h3>Past outcomes guide future grading.</h3>
            <p>
              Clyde scans labeled opportunities with transcripts, scorecards, notes, and outcomes, then uses a capped mix of rejected,
              advanced, and offer examples to calculate confidence and write phase-specific feedback.
            </p>
            <p>
              The current opportunity is excluded from its own calibration set, so the confidence score is judged against prior real outcomes.
            </p>
          </div>
        </div>
      </section>

      <FinalCta onDownload={onDownload} />
    </main>
  );
}

function FullOverlayShowcase() {
  return (
    <section className="section-band full-overlay-band" data-reveal>
      <div className="full-overlay-copy">
        <span className="eyebrow">Live capture mode</span>
        <h2>Live answer cards that stay out of the way.</h2>
        <p>
          Clyde can surface transparent, glanceable suggestions during a call so you get help without covering the meeting or breaking focus.
          It can also display relevant memory from RAG files, notes, or previous sessions beside the suggested answer.
        </p>
      </div>
      <figure className="full-overlay-figure">
        <img src="/Clyde Screenshots/Full Desktop Overlay View.svg" alt="Full Clyde desktop overlay showing a live question and answer card beside a relevant memory card from RAG files" loading="lazy" />
        <figcaption>
          <strong>Example:</strong> Clyde hears a question, drafts a concise response, and surfaces supporting facts from relevant RAG files while the call is still happening.
        </figcaption>
      </figure>
    </section>
  );
}

function HeroScene() {
  return (
    <div className="hero-scene" aria-hidden="true">
      <div className="hero-device">
        <div className="device-bar">
          <span />
          <span />
          <span />
          <strong>Clyde Assistant live</strong>
        </div>
        <div className="demo-placeholder">
          <span>Undetectable live interview cockpit</span>
          <div className="scan-line" />
        </div>
        <div className="transcript-pane">
          <p><strong>Interviewer</strong> How would you handle a vague product requirement?</p>
          <p><strong>Clyde</strong> Mention discovery, risk framing, stakeholder alignment, and a measurable next step.</p>
        </div>
      </div>
      <div className="floating-card answer-card">
        <span>Suggested answer</span>
        <p>Start with clarifying questions, propose a thin slice, and explain how you would validate with users.</p>
      </div>
      <div className="floating-card prep-card">
        <span>Active context</span>
        <p>Last call: they cared about autonomy, cross-functional pressure, and clean tradeoff thinking.</p>
      </div>
    </div>
  );
}

function FeatureTabs() {
  const [activeId, setActiveId] = useState(featureTabs[0].id);
  const active = useMemo(() => featureTabs.find((feature) => feature.id === activeId) || featureTabs[0], [activeId]);

  return (
    <div className="feature-tabs">
      <div className="tab-list" role="tablist" aria-label="Clyde features">
        {featureTabs.map((feature) => (
          <button
            key={feature.id}
            aria-selected={feature.id === activeId}
            className={feature.id === activeId ? 'active' : ''}
            onClick={() => setActiveId(feature.id)}
            role="tab"
            type="button"
          >
            {feature.label}
          </button>
        ))}
      </div>
      <div className="feature-stage" role="tabpanel">
        <div className="feature-copy">
          <h3>{active.title}</h3>
          <p>{active.body}</p>
          <ul>
            {active.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
          </ul>
        </div>
        <div className={`feature-preview ${active.id}`}>
          <strong>{active.stat}</strong>
          <span>{active.label}</span>
          <div className="mini-bars">
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkflowCard({ body, number, title }) {
  return (
    <article className="workflow-card">
      <span>{number}</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

function TierSection() {
  return (
    <section className="section-band tier-band" data-reveal>
      <div className="section-heading compact">
        <h2>Choose your Clyde. Use Pro free during beta.</h2>
        <p>Free users get Clyde Assistant for focused active-context help. Pro users unlock Clyde Pro Agent for RAG, broader memory, Google sync, autonomous updates, and advanced interview intelligence.</p>
      </div>
      <div className="tier-grid">
        {tiers.map((tier) => (
          <article className={`tier-card ${tier.name.toLowerCase()}`} key={tier.name}>
            <img src={tier.icon} alt={`${tier.name} tier Clyde icon`} />
            <div>
              <span>{tier.name} tier</span>
              <img className="tier-logo" src={tier.logo} alt={`Clyde ${tier.name}`} />
              <p>{tier.body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function MockInterviewSection() {
  return (
    <section className="section-band mock-band" data-reveal>
      <div className="mock-copy">
        <span className="eyebrow">Realtime mock interviews</span>
        <h2>Practice against the role you are actually interviewing for.</h2>
        <p>
          Clyde Pro can run context-aware mock interviews for the active opportunity, ask role-specific questions, then generate a
          0-100 scorecard with direct feedback, confidence signals, and the exact areas to improve before the real call.
        </p>
        <div className="mock-points">
          <span>Role-specific questions</span>
          <span>Live follow-ups</span>
          <span>Post-mock scorecard</span>
        </div>
      </div>
      <div className="liveavatar-demo">
        <LiveAvatarPracticeDemo />
      </div>
    </section>
  );
}

function MockScorecardShowcase() {
  return (
    <section className="section-band image-showcase-band" data-reveal>
      <div className="section-heading compact">
        <h2>Mock interviews end with a real scorecard.</h2>
        <p>After practice, Clyde Pro turns the transcript into a 0-100 score, category ratings, strengths, risks, and a concrete improvement plan.</p>
      </div>
      <figure className="large-product-figure">
        <img src="/Clyde Screenshots/mock interview scorecard.svg" alt="Clyde mock interview scorecard with detailed assessment categories and feedback" loading="lazy" />
      </figure>
    </section>
  );
}

function AssistantAgentShowcase() {
  return (
    <figure className="inline-product-figure assistant-agent-figure">
      <img src="/Clyde Screenshots/Assistant vs Agent.svg" alt="Comparison of Clyde Assistant free features and Clyde Pro Agent capabilities" loading="lazy" />
    </figure>
  );
}

function TrendShowcase() {
  return (
    <section className="section-band image-showcase-band" data-reveal>
      <div className="section-heading compact">
        <h2>Trend analysis shows how you are improving.</h2>
        <p>See performance by opportunity, outcome, confidence, and phase so you know exactly where you are getting stronger and where to focus next.</p>
      </div>
      <figure className="large-product-figure">
        <img src="/Clyde Screenshots/Trend.svg" alt="Clyde trend analysis screen showing interview opportunities, outcomes, and confidence scores" loading="lazy" />
      </figure>
    </section>
  );
}

function LiveAvatarPracticeDemo() {
  const videoRef = useRef(null);
  const sessionRef = useRef(null);
  const [state, setState] = useState('idle');
  const [message, setMessage] = useState('Start a realtime avatar practice call directly from the site.');

  useEffect(() => {
    return () => {
      sessionRef.current?.stop?.();
      sessionRef.current = null;
    };
  }, []);

  async function startDemo() {
    setState('connecting');
    setMessage('Starting avatar practice session...');
    try {
      const response = await fetch('/api/liveavatar-token', { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.sessionToken) {
        throw new Error(payload.error || 'LiveAvatar token endpoint is not available.');
      }

      const session = new LiveAvatarSession(payload.sessionToken);
      sessionRef.current = session;
      session.on(SessionEvent.SESSION_STREAM_READY, () => {
        if (videoRef.current) {
          session.attach(videoRef.current);
          videoRef.current.play?.().catch?.(() => {});
        }
        session.voiceChat?.start?.();
        setState('connected');
        setMessage('Avatar is live. Allow microphone access and start speaking.');
      });
      session.on(SessionEvent.SESSION_DISCONNECTED, () => {
        setState('idle');
        setMessage('Avatar session ended.');
      });

      await session.start();
    } catch (error) {
      setState('error');
      setMessage(error.message || 'Failed to start the LiveAvatar session.');
      sessionRef.current?.stop?.();
      sessionRef.current = null;
    }
  }

  function stopDemo() {
    sessionRef.current?.stop?.();
    sessionRef.current = null;
    setState('idle');
    setMessage('Avatar session stopped.');
  }

  return (
    <div className={`liveavatar-sdk-demo ${state}`}>
      <div className="liveavatar-demo-label">LiveAvatar practice demo</div>
      {state === 'idle' || state === 'error' ? (
        <div className="liveavatar-thumbnail">
          <img src="/Clyde Screenshots/LiveAvatar Thumbnail.png" alt="LiveAvatar practice preview" />
          <button type="button" className="liveavatar-thumbnail-cta" onClick={startDemo}>Start a live practice chat</button>
        </div>
      ) : null}
      <video ref={videoRef} playsInline autoPlay className={state === 'connected' || state === 'connecting' ? 'visible' : ''} />
      <div className="liveavatar-controls">
        <p>{message}</p>
        {state === 'connected' || state === 'connecting' ? (
          <button type="button" className="secondary-link" onClick={stopDemo}>Stop demo</button>
        ) : state === 'error' ? (
          <button type="button" className="primary-link" onClick={startDemo}>Start avatar practice</button>
        ) : null}
      </div>
    </div>
  );
}

function PrivacyVisual() {
  return (
    <div className="privacy-visual">
      <div className="share-window">
        <div className="share-top">
          <span />
          <span />
          <span />
          <strong>Shared screen</strong>
        </div>
        <div className="shared-content">
          <div className="slide-lines">
            <i />
            <i />
            <i />
          </div>
          <div className="protected-zone">
            <span>Capture protected Clyde HUD</span>
          </div>
        </div>
      </div>
      <div className="privacy-status">
        <span>Visible to you</span>
        <strong>Hidden from standard screen capture where supported</strong>
      </div>
    </div>
  );
}

function LearningLoop() {
  return (
    <div className="learning-loop">
      <article>
        <span>1</span>
        <h3>Save transcripts</h3>
        <p>Every interview and meeting produces a searchable transcript, notes, action items, and scorecard.</p>
      </article>
      <article>
        <span>2</span>
        <h3>Track outcomes</h3>
        <p>Clyde can scan Gmail and Calendar to suggest or autonomously apply status, invite, and next-step updates.</p>
      </article>
      <article>
        <span>3</span>
        <h3>Improve the next round</h3>
        <p>Past outcomes calibrate confidence scores and trend analysis so feedback becomes more realistic over time.</p>
      </article>
    </div>
  );
}

function ComparisonTable() {
  return (
    <div className="comparison-table" role="table" aria-label="Clyde comparison">
      <div className="comparison-row comparison-head" role="row">
        <span role="columnheader">Capability</span>
        <span role="columnheader">Standard notetaker</span>
        <span role="columnheader">Clyde</span>
      </div>
      {comparisonRows.map(([capability, standard, clyde]) => (
        <div className="comparison-row" role="row" key={capability}>
          <span role="cell">{capability}</span>
          <span role="cell">{standard}</span>
          <span role="cell">{clyde}</span>
        </div>
      ))}
    </div>
  );
}

function PlaceholderWall() {
  const carouselRef = useRef(null);
  const placeholders = [
    {
      label: 'Beautiful meeting notes and action items after every call',
      src: '/Clyde Screenshots/Meeting Notes.png'
    },
    {
      label: 'Floating chat for opportunities, meetings, and career advice',
      src: '/Clyde Screenshots/Floating Widget.png'
    },
    {
      label: 'Gmail and Google Calendar opportunity automation',
      src: '/Clyde Screenshots/Google Sync.png'
    },
    {
      label: 'Local LLM support for private on-device assistance',
      src: '/Clyde Screenshots/Local LLM.png'
    },
    {
      label: 'Screen capture protection controls for undetectable mode',
      src: '/Clyde Screenshots/Screen Capture Detection Enabled.png'
    }
  ];

  function scrollCarousel(direction) {
    const node = carouselRef.current;
    if (!node) return;
    node.scrollBy({ left: direction * node.clientWidth, behavior: 'smooth' });
  }

  return (
    <div className="screenshot-carousel-shell">
      <div className="carousel-controls" aria-label="Screenshot carousel controls">
        <button type="button" onClick={() => scrollCarousel(-1)} aria-label="Previous screenshot">Previous</button>
        <button type="button" onClick={() => scrollCarousel(1)} aria-label="Next screenshot">Next</button>
      </div>
      <div className="placeholder-wall screenshot-carousel" ref={carouselRef}>
        {placeholders.map((item) => (
          <article className="media-slot screenshot-slot" key={item.label}>
            <div className="screenshot-frame">
              <img src={item.src} alt={item.label} loading="lazy" />
            </div>
            <h3>{item.label}</h3>
          </article>
        ))}
      </div>
    </div>
  );
}

function HomeScreenFeature() {
  return (
    <section className="section-band home-screen-band" data-reveal>
      <div className="section-heading compact">
        <h2>A clean command center for every opportunity.</h2>
        <p>Clyde keeps the home screen minimal: your next meetings, active context, captured notes, and agent actions stay visible without turning the app into a dashboard maze.</p>
      </div>
      <div className="home-screen-showcase">
        <img src="/Clyde Screenshots/Home Screen.svg" alt="Clyde home screen showing a clean, minimal opportunity workspace" loading="lazy" />
        <div className="home-screen-notes">
          <span>Minimal by design</span>
          <h3>Fast to understand. Hard to clutter.</h3>
          <p>Everything is organized around what you need next: start a meeting, review prep, inspect recent notes, or ask Clyde to take action.</p>
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section className="section-band faq-band" id="faq" data-reveal>
      <div className="section-heading">
        <h2>Questions before you run it live.</h2>
      </div>
      <div className="faq-list">
        {faqs.map((item) => (
          <details key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCta({ onDownload }) {
  return (
    <section className="final-cta" data-reveal>
      <img src="/clydefree.svg" alt="" />
      <h2>Bring Clyde to your next interview or meeting.</h2>
      <p>Download the pre-release Windows beta if you want early access before the stable public launch.</p>
      <a className="primary-link" href={downloadHref} onClick={onDownload} download>Download for Windows</a>
    </section>
  );
}

function ArchitectureVisual() {
  return (
    <div className="architecture-visual" data-reveal>
      <div className="arch-node input">Audio + screen</div>
      <div className="arch-node context">Transcript + sources</div>
      <div className="arch-node model">Local or cloud AI</div>
      <div className="arch-node output">Answer cards + analysis</div>
    </div>
  );
}

function DownloadModal({ onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="download-modal" role="dialog" aria-modal="true" aria-labelledby="download-title" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close download notice">×</button>
        <h2 id="download-title">Early-access Windows beta</h2>
        <p>
          This is a pre-release build for early-access users. The Windows installer is available at <code>{downloadHref}</code>.
        </p>
        <div className="modal-actions">
          <a className="primary-link" href={downloadHref} download>Download installer</a>
          <button className="secondary-link" type="button" onClick={onClose}>Keep browsing</button>
        </div>
      </div>
    </div>
  );
}

function Footer({ navigate, onDownload }) {
  return (
    <footer className="site-footer">
      <div>
        <button className="brand-link" type="button" onClick={() => navigate('/')}>
          <img src="/clydefree.svg" alt="" />
          <span>Clyde</span>
        </button>
        <p>Private AI help for interviews and meetings.</p>
      </div>
      <div className="footer-links">
        <button type="button" onClick={() => navigate('/how-it-works')}>How it works</button>
        <a href="#privacy">Privacy</a>
        <a href="#faq">FAQ</a>
        <a href={downloadHref} onClick={onDownload} download>Download Windows</a>
      </div>
    </footer>
  );
}

function AnimatedBackdrop() {
  return (
    <div className="animated-backdrop" aria-hidden="true">
      <div className="grid-plane" />
      <div className="light-sweep one" />
      <div className="light-sweep two" />
      <div className="particle-field">
        {Array.from({ length: 26 }).map((_, index) => <span key={index} style={{ '--i': index }} />)}
      </div>
    </div>
  );
}

function normalizePath(value) {
  if (!value || value === '/index.html') return '/';
  return value.endsWith('/') && value.length > 1 ? value.slice(0, -1) : value;
}

export default App;
