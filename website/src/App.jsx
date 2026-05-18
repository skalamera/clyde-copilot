import { useEffect, useMemo, useState } from 'react';

const downloadHref = '/downloads/clyde-windows.exe';

const featureTabs = [
  {
    id: 'live',
    label: 'Live assist',
    title: 'Answers while the call is still happening.',
    body: 'Clyde listens to your microphone and system audio, keeps a rolling transcript, and gives you a short answer when you need one.',
    bullets: ['One-tap answer cards', 'Screenshot-aware prompts', 'Speaker-aware transcript turns'],
    stat: 'Live'
  },
  {
    id: 'interviews',
    label: 'Interview timeline',
    title: 'Every opportunity gets memory.',
    body: 'Track company, role, interview phase, job description, transcript rating, confidence, and next event in one place.',
    bullets: ['Pre-call prep from prior rounds', 'Transcript grading from 0 to 5', 'Confidence and trend by opportunity'],
    stat: '88%'
  },
  {
    id: 'learning',
    label: 'Outcome learning',
    title: 'Your real outcomes tune the next round.',
    body: 'Mark an opportunity as advanced, rejected, or offer. Clyde uses those local examples when grading future transcripts.',
    bullets: ['Rejected and offer examples', 'Local prompt calibration', 'No provider training job required'],
    stat: '+2'
  }
];

const comparisonRows = [
  ['No meeting bot joins the call', 'Often joins as a visible attendee', 'Desktop assistant stays outside the guest list'],
  ['Screen-share privacy control', 'Shared windows can expose tools', 'Capture Protection hides Clyde from standard captures where supported'],
  ['Interview-specific memory', 'Generic notes after the call', 'Company, role, JD, phase, transcript rating, and confidence live together'],
  ['Outcome-labeled learning', 'One-off transcript summaries', 'Rejected, advanced, and offer outcomes calibrate future grading'],
  ['Local-first AI path', 'Cloud-only processing', 'Use local Whisper and LM Studio, or connect cloud APIs when you choose'],
  ['Screenshot-aware answers', 'Audio-only context', 'Ask about the screen, transcript, resume, job description, or memory']
];

const faqs = [
  {
    question: 'Does Clyde join my meeting?',
    answer: 'No. Clyde runs as a desktop app on your machine, so it does not appear as a meeting participant or bot.'
  },
  {
    question: 'What does Capture Protection do?',
    answer: 'It uses Electron content protection and overlay behavior to keep the active Clyde HUD out of standard screen sharing or recording paths where the operating system and meeting app support it.'
  },
  {
    question: 'Can Clyde run locally?',
    answer: 'Yes. Clyde can use local Whisper for transcription and LM Studio for LLM responses. You can also connect cloud providers when you want.'
  },
  {
    question: 'How does Clyde learn from outcomes?',
    answer: 'You label opportunities as advanced, rejected, or offer. Clyde reads those local examples when it grades new transcripts and computes confidence.'
  }
];

const howSteps = [
  {
    title: 'Audio capture',
    body: 'Clyde captures microphone and system audio separately, labels speakers as you and others, and shows live levels before transcript text is created.'
  },
  {
    title: 'Transcript cleanup',
    body: 'Quiet audio and known hallucination phrases are filtered before transcript turns reach the UI, saved sessions, or assistant context.'
  },
  {
    title: 'Context pack',
    body: 'The assistant can read the recent transcript, your resume notes, the job description, long-term memory, RAG sources, and screenshots.'
  },
  {
    title: 'Answer cards',
    body: 'Clyde returns short cards for what to say next, follow-up questions, recap points, risks, and screen-specific help.'
  },
  {
    title: 'Post-call grading',
    body: 'Interview transcripts get a 0 to 5 rating, written feedback, examples, confidence score, and trend analysis for that opportunity.'
  },
  {
    title: 'Outcome calibration',
    body: 'After you mark real outcomes, Clyde compares new transcripts against your local rejected, advanced, and offer examples.'
  }
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
    event.preventDefault();
    setDownloadOpen(true);
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
        <img src="/clyde_ghost.svg" alt="" />
        <span>Clyde</span>
      </button>
      <nav aria-label="Primary navigation">
        <button type="button" onClick={() => navigate('/')} className={path === '/' ? 'active' : ''}>Home</button>
        <button type="button" onClick={() => navigate('/how-it-works')} className={path === '/how-it-works' ? 'active' : ''}>How it works</button>
        <a href="#privacy">Privacy</a>
        <a href="#faq">FAQ</a>
      </nav>
      <a className="header-cta" href={downloadHref} onClick={onDownload}>Download for Windows</a>
    </header>
  );
}

function LandingPage({ navigate, onDownload }) {
  return (
    <main>
      <section className="hero-section">
        <HeroScene />
        <div className="hero-copy" data-reveal>
          <h1>Private AI help for interviews and meetings, while the call is live.</h1>
          <p>
            Clyde gives you real-time answers, pre-call prep, transcript grading, and outcome learning from your own interviews.
            It runs as a desktop assistant with local-first AI options and screen-share privacy controls.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href={downloadHref} onClick={onDownload}>Download for Windows</a>
            <button className="secondary-link" type="button" onClick={() => navigate('/how-it-works')}>See how it works</button>
          </div>
        </div>
        <div className="scroll-cue" aria-hidden="true">
          <span />
        </div>
      </section>

      <section className="section-band product-band" data-reveal>
        <div className="section-heading">
          <h2>One assistant for the parts of the call that matter.</h2>
          <p>Clyde is built around the live moment, then keeps learning from what happened after.</p>
        </div>
        <FeatureTabs />
      </section>

      <section className="section-band workflow-band" data-reveal>
        <div className="section-heading compact">
          <h2>From question to answer in seconds.</h2>
          <p>Ask about the transcript, the screen, the job description, or your saved context.</p>
        </div>
        <div className="workflow-grid">
          <WorkflowCard number="01" title="Listen" body="Clyde captures microphone and system audio, then builds a speaker-aware live transcript." />
          <WorkflowCard number="02" title="Read context" body="It can add screenshots, resume notes, job descriptions, memory, and selected RAG sources." />
          <WorkflowCard number="03" title="Answer" body="You get concise cards for what to say next, follow-ups, recap, and risks." />
        </div>
      </section>

      <section className="section-band privacy-band" id="privacy" data-reveal>
        <div className="privacy-copy">
          <h2>Built for screen-share privacy.</h2>
          <p>
            Clyde runs on your desktop and does not join meetings as a bot. Capture Protection uses platform-level content protection
            so the active overlay stays out of standard screen shares and recordings where supported.
          </p>
          <button type="button" className="secondary-link" onClick={() => navigate('/how-it-works')}>Read the technical flow</button>
        </div>
        <PrivacyVisual />
      </section>

      <section className="section-band learning-band" data-reveal>
        <div className="section-heading">
          <h2>Clyde learns from the outcomes you mark.</h2>
          <p>Rejected, advanced, and offer labels become local examples for the next grading run.</p>
        </div>
        <LearningLoop />
      </section>

      <section className="section-band comparison-band" data-reveal>
        <div className="section-heading">
          <h2>Why Clyde is different from standard AI notetakers.</h2>
          <p>Most tools write a recap after the call. Clyde also helps during the call and tracks the full opportunity.</p>
        </div>
        <ComparisonTable />
      </section>

      <section className="section-band proof-band" data-reveal>
        <div className="section-heading compact">
          <h2>Real media slots, ready for launch proof.</h2>
          <p>Drop in demo clips, user screenshots, and outcome screenshots when they are ready.</p>
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
          <h1>How Clyde listens, helps, protects the screen, and learns.</h1>
          <p>
            Clyde combines live capture, context-aware prompting, local storage, and outcome calibration so the feedback gets closer
            to your real interview market over time.
          </p>
        </div>
        <ArchitectureVisual />
      </section>

      <section className="section-band steps-band" data-reveal>
        <div className="section-heading">
          <h2>The call flow.</h2>
          <p>Each step maps to a real Clyde subsystem in the desktop app.</p>
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

      <section className="section-band technical-band" data-reveal>
        <div className="technical-panel">
          <h2>Screen-share privacy details.</h2>
          <p>
            Clyde’s Capture Protection can call Electron content protection and keep its active capture window in an overlay mode.
            This is meant to keep Clyde out of common shared-screen and recording surfaces where the OS supports that behavior.
          </p>
          <p>
            Meeting apps, operating systems, and capture drivers can differ. The site should describe this as a privacy control,
            not as a universal detection guarantee.
          </p>
        </div>
        <div className="technical-panel accent">
          <h2>Local-first data path.</h2>
          <p>
            Audio can go to local Whisper. Answers can come from LM Studio. Transcripts, job descriptions, meetings, and opportunity
            outcomes stay in local Clyde storage unless you connect cloud services.
          </p>
          <p>
            Source toggles let you choose which context Clyde reads during a call: resume, memory, RAG, web search, screen, and transcript.
          </p>
        </div>
      </section>

      <section className="section-band learning-detail-band" data-reveal>
        <div className="section-heading">
          <h2>How learning works.</h2>
          <p>The current version uses local calibration examples rather than provider fine-tuning.</p>
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
            <h3>Local examples guide future grading.</h3>
            <p>
              Clyde scans labeled opportunities with transcripts, builds compact examples, and injects a capped mix of rejected and
              advanced or offer examples into grading, confidence, and trend prompts.
            </p>
            <p>
              The current opportunity is excluded from its own calibration set, so the score is judged against prior real outcomes.
            </p>
          </div>
        </div>
      </section>

      <FinalCta onDownload={onDownload} />
    </main>
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
          <strong>Clyde live</strong>
        </div>
        <div className="demo-placeholder">
          <span>Hero app preview video placeholder</span>
          <div className="scan-line" />
        </div>
        <div className="transcript-pane">
          <p><strong>Interviewer</strong> Walk me through the support analytics work.</p>
          <p><strong>You</strong> I built an AI QA workflow for ticket scoring and manager coaching.</p>
        </div>
      </div>
      <div className="floating-card answer-card">
        <span>Answer</span>
        <p>Lead with the operational problem, then tie the tooling to faster reviews and cleaner coaching.</p>
      </div>
      <div className="floating-card prep-card">
        <span>Pre-call prep</span>
        <p>Likely focus: workflow ownership, metrics, and how you handled rollout risk.</p>
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
        <p>Each round is tied to the company, role, phase, and job description.</p>
      </article>
      <article>
        <span>2</span>
        <h3>Mark outcome</h3>
        <p>Set active, advanced, rejected, or offer when you learn what happened.</p>
      </article>
      <article>
        <span>3</span>
        <h3>Calibrate next score</h3>
        <p>Clyde uses labeled examples when grading new sessions and writing prep.</p>
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
  const placeholders = [
    'Active capture overlay preview',
    'Interview timeline and trends preview',
    'How Clyde learns visual',
    'Screen-share privacy visual'
  ];
  return (
    <div className="placeholder-wall">
      {placeholders.map((label) => (
        <div className="media-slot" key={label}>
          <span>{label}</span>
        </div>
      ))}
    </div>
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
      <img src="/clyde_ghost.svg" alt="" />
      <h2>Bring Clyde to your next interview or meeting.</h2>
      <p>Start with the Windows build slot, then replace the placeholder installer when the public package is ready.</p>
      <a className="primary-link" href={downloadHref} onClick={onDownload}>Download for Windows</a>
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
      <div className="arch-path a" />
      <div className="arch-path b" />
      <div className="arch-path c" />
    </div>
  );
}

function DownloadModal({ onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="download-modal" role="dialog" aria-modal="true" aria-labelledby="download-title" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close download notice">×</button>
        <h2 id="download-title">Windows download placeholder</h2>
        <p>
          The public CTA points to <code>{downloadHref}</code>. Replace that placeholder file with the signed Clyde installer before launch.
        </p>
        <div className="modal-actions">
          <a className="primary-link" href={downloadHref} download>Open placeholder file</a>
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
          <img src="/clyde_ghost.svg" alt="" />
          <span>Clyde</span>
        </button>
        <p>Private AI help for interviews and meetings.</p>
      </div>
      <div className="footer-links">
        <button type="button" onClick={() => navigate('/how-it-works')}>How it works</button>
        <a href="#privacy">Privacy</a>
        <a href="#faq">FAQ</a>
        <a href={downloadHref} onClick={onDownload}>Download Windows</a>
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
