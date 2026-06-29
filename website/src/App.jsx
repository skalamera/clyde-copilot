import { useEffect, useMemo, useRef, useState } from 'react';
import { LiveAvatarSession, SessionEvent } from '@heygen/liveavatar-web-sdk';

const downloadHref = 'ms-windows-store://pdp/?productid=XPFP272Z1BX0P1';

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
  const [upgradeNotice, setUpgradeNotice] = useState('');

  function showUpgradeNotice() {
    setUpgradeNotice('Open Clyde desktop, sign in, then use Settings > Account > Get Clyde Pro.');
  }

  useEffect(() => {
    // If we land with a hash containing access_token, check if we need to redirect to auth/confirmed
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = hashParams.get('access_token');
    const type = hashParams.get('type');
    if (token && (type === 'recovery' || type === 'invite' || type === 'signup')) {
      // Redirect them to /auth/confirmed with the same hash so AuthConfirmedPage can read it
      window.history.replaceState({}, '', `/auth/confirmed${window.location.hash}`);
      setPath('/auth/confirmed');
    }
  }, []);

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
    : path === '/pricing'
      ? <PricingPage showUpgradeNotice={showUpgradeNotice} navigate={navigate} />
    : path === '/about'
      ? <AboutPage navigate={navigate} />
    : path === '/clyde-go'
      ? <ClydeGoPage />
    : path === '/support'
      ? <SupportPage />
    : path === '/kb' || path === '/knowledge-base'
      ? <KnowledgeBasePage navigate={navigate} />
    : path === '/privacy-policy'
      ? <PrivacyPolicyPage />
      : path === '/terms-of-service'
        ? <TermsOfServicePage />
        : path === '/auth/confirmed'
          ? <AuthConfirmedPage />
          : path === '/billing/success'
            ? <BillingSuccessPage />
          : path === '/forgot-password'
            ? <ForgotPasswordPage navigate={navigate} />
          : path === '/delete-account'
            ? <DeleteAccountPage navigate={navigate} />
          : path === '/practice' || path === '/interview-prep-tool'
            ? <PracticePage onDownload={handleDownload} navigate={navigate} />
          : <LandingPage onDownload={handleDownload} navigate={navigate} />;

  return (
    <div className="site-shell">
      <AnimatedBackdrop />
      <Header path={path} navigate={navigate} onDownload={handleDownload} upgradeNotice={upgradeNotice} showUpgradeNotice={showUpgradeNotice} />
      {currentPage}
      <Footer navigate={navigate} onDownload={handleDownload} />
      {downloadOpen ? <DownloadModal onClose={() => setDownloadOpen(false)} /> : null}
      <FloatingSupportChatbot />
    </div>
  );
}

function Header({ navigate, onDownload, path, upgradeNotice, showUpgradeNotice }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleNavigate = (targetPath) => {
    setMenuOpen(false);
    navigate(targetPath);
  };

  return (
    <header className="site-header">
      <a className="brand-link" href="/" onClick={(event) => { event.preventDefault(); handleNavigate('/'); }}>
        <img src="/clyde-free-logo-textonly.svg" alt="Clyde" />
      </a>
      
      {/* Desktop Navigation */}
      <nav aria-label="Primary navigation" className="desktop-nav">
        <a href="/" onClick={(event) => { event.preventDefault(); handleNavigate('/'); }} className={path === '/' ? 'active' : ''}>Home</a>
        <a href="/clyde-go" onClick={(event) => { event.preventDefault(); handleNavigate('/clyde-go'); }} className={path === '/clyde-go' ? 'active' : ''}>Clyde Go<span className="nav-badge">Soon</span></a>
        <a href="/how-it-works" onClick={(event) => { event.preventDefault(); handleNavigate('/how-it-works'); }} className={path === '/how-it-works' ? 'active' : ''}>How it works</a>
        <a href="/about" onClick={(event) => { event.preventDefault(); handleNavigate('/about'); }} className={path === '/about' ? 'active' : ''}>About</a>
        <a href="/pricing" onClick={(event) => { event.preventDefault(); handleNavigate('/pricing'); }} className={path === '/pricing' ? 'active' : ''}>Pricing</a>
        <a href="/support" onClick={(event) => { event.preventDefault(); handleNavigate('/support'); }} className={path === '/support' ? 'active' : ''}>Support</a>
        <a href="/kb" onClick={(event) => { event.preventDefault(); handleNavigate('/kb'); }} className={path === '/kb' || path === '/knowledge-base' ? 'active' : ''}>KB</a>
        <a href="/privacy-policy" onClick={(event) => { event.preventDefault(); handleNavigate('/privacy-policy'); }} className={path === '/privacy-policy' ? 'active' : ''}>Privacy</a>
        <a href="#faq">FAQ</a>
      </nav>

      <div className="header-actions desktop-actions">
        <button className="header-cta header-pro-cta" type="button" onClick={() => handleNavigate('/pricing')}>Get Clyde Pro</button>
        <a className="header-cta" href={downloadHref} onClick={onDownload}>Download for Windows</a>
      </div>

      {/* Mobile Hamburger Button */}
      <button 
        type="button" 
        className={`mobile-menu-toggle ${menuOpen ? 'open' : ''}`} 
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle navigation menu"
      >
        <span className="hamburger-bar" />
        <span className="hamburger-bar" />
        <span className="hamburger-bar" />
      </button>

      {/* Mobile Slide-out Menu Overlay */}
      <div className={`mobile-slideout-menu ${menuOpen ? 'open' : ''}`}>
        <img 
          src="/jedana_studio_mobile_sidemenu.svg" 
          alt="Jedana Studio" 
          style={{ 
            width: '100%', 
            maxHeight: '180px', 
            objectFit: 'contain',
            borderRadius: '16px', 
            border: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(255,255,255,0.02)',
            padding: '12px',
            boxSizing: 'border-box',
            marginBottom: '10px'
          }} 
        />
        <div className="mobile-menu-actions" style={{ marginTop: '0', display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
          <button className="header-cta header-pro-cta" type="button" onClick={() => handleNavigate('/pricing')}>Get Clyde Pro</button>
          <a className="header-cta" href={downloadHref} onClick={(e) => { setMenuOpen(false); onDownload(e); }}>Download for Windows</a>
        </div>
        <nav aria-label="Mobile navigation">
          <a href="/" onClick={(event) => { event.preventDefault(); handleNavigate('/'); }} className={path === '/' ? 'active' : ''}>Home</a>
          <a href="/clyde-go" onClick={(event) => { event.preventDefault(); handleNavigate('/clyde-go'); }} className={path === '/clyde-go' ? 'active' : ''}>Clyde Go<span className="nav-badge">Soon</span></a>
          <a href="/how-it-works" onClick={(event) => { event.preventDefault(); handleNavigate('/how-it-works'); }} className={path === '/how-it-works' ? 'active' : ''}>How it works</a>
          <a href="/about" onClick={(event) => { event.preventDefault(); handleNavigate('/about'); }} className={path === '/about' ? 'active' : ''}>About</a>
          <a href="/pricing" onClick={(event) => { event.preventDefault(); handleNavigate('/pricing'); }} className={path === '/pricing' ? 'active' : ''}>Pricing</a>
          <a href="/support" onClick={(event) => { event.preventDefault(); handleNavigate('/support'); }} className={path === '/support' ? 'active' : ''}>Support</a>
        <a href="/kb" onClick={(event) => { event.preventDefault(); handleNavigate('/kb'); }} className={path === '/kb' || path === '/knowledge-base' ? 'active' : ''}>KB</a>
          <a href="/privacy-policy" onClick={(event) => { event.preventDefault(); handleNavigate('/privacy-policy'); }} className={path === '/privacy-policy' ? 'active' : ''}>Privacy</a>
          <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
        </nav>
      </div>

      {upgradeNotice ? <span className="header-checkout-status">{upgradeNotice}</span> : null}
    </header>
  );
}

function ClydeGoPairingSection() {
  return (
    <section className="section-band pairing-band" style={{ background: 'radial-gradient(circle at top right, rgba(0, 245, 255, 0.05), transparent 60%)', borderTop: '1px solid rgba(255,255,255,0.03)', padding: '60px 24px' }} data-reveal>
      <div className="section-heading" style={{ textAlign: 'center', marginBottom: '40px' }}>
        <span style={{ fontSize: '0.9rem', color: '#00f5ff', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px', display: 'block', marginBottom: '8px' }}>
          Unmatched Synergy
        </span>
        <h2 style={{ fontSize: '2.5rem', lineHeight: '1.2', marginBottom: '16px', color: '#fff' }}>
          Clyde Desktop + Clyde Go: The Complete End-to-End Career Copilot
        </h2>
        <p style={{ fontSize: '1.1rem', color: 'var(--muted)', maxWidth: '800px', margin: '0 auto 12px auto' }}>
          Separately they are powerful. Together they form an unbeatable, automated pipeline from first click to final offer.
        </p>
        <strong style={{ fontSize: '1.4rem', color: '#00f5ff', display: 'block', margin: '20px 0', fontFamily: 'inherit', letterSpacing: '-0.5px' }}>
          "Don't get ghosted. Get Clyde."
        </strong>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px', padding: '0 24px', maxWidth: '1200px', margin: '40px auto 0 auto', boxSizing: 'border-box' }}>
        
        {/* Card 1: Clyde Go (The Extension Front-End) */}
        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px', backdropFilter: 'blur(10px)', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '2rem' }}>⚡</span>
            <h3 style={{ margin: 0, fontSize: '1.4rem', color: '#fff' }}>Clyde Go Extension</h3>
          </div>
          <p style={{ fontSize: '0.95rem', color: 'var(--muted)', margin: 0, lineHeight: '1.6' }}>
            Your high-performance browser assistant. Clip jobs, auto-generate materials, and autonomously fill application forms in seconds.
          </p>
          <ul style={{ paddingLeft: '20px', color: 'var(--muted)', fontSize: '0.9rem', lineHeight: '1.8', margin: 0 }}>
            <li><strong style={{ color: '#00f5ff' }}>AI Apply Form Filler:</strong> Autonomously completes complex job forms, including unique, non-standard, and open-ended essay questions on any major applicant portal.</li>
            <li><strong style={{ color: '#00f5ff' }}>Answer with Clyde:</strong> Instantly answers any custom application prompt or query with personalized responses calibrated directly to your experience.</li>
            <li><strong style={{ color: '#00f5ff' }}>Auto-Generate Tailored Docs:</strong> Generate bespoke resumes, hyper-tailored cover letters, custom LinkedIn outreach DMs, and comprehensive STAR Q&As in one click.</li>
            <li><strong style={{ color: '#00f5ff' }}>ATS Readiness Score:</strong> Get an instant readiness rating with actionable keyword suggestions to guarantee you bypass initial parsing bots.</li>
          </ul>
        </div>

        {/* Card 2: Clyde Desktop (The Invisible Engine) */}
        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px', backdropFilter: 'blur(10px)', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '2rem' }}>🖥️</span>
            <h3 style={{ margin: 0, fontSize: '1.4rem', color: '#fff' }}>Clyde Desktop App</h3>
          </div>
          <p style={{ fontSize: '0.95rem', color: 'var(--muted)', margin: 0, lineHeight: '1.6' }}>
            Your silent department lead. Synchronizes your clipped opportunities, connects calendar workflows, and guides you undetected during live calls.
          </p>
          <ul style={{ paddingLeft: '20px', color: 'var(--muted)', fontSize: '0.9rem', lineHeight: '1.8', margin: 0 }}>
            <li><strong style={{ color: '#00f5ff' }}>Real-time Clip Sync:</strong> Every job clipped in Chrome instantly synchronizes to your desktop database, setting up your prep workspace automatically.</li>
            <li><strong style={{ color: '#00f5ff' }}>Undetectable Interview Copilot:</strong> Listens to live call audio, transcribes speaker-aware tracks, and flashes real-time answer cards silently on your screen.</li>
            <li><strong style={{ color: '#00f5ff' }}>Stealth Shield Capabilities:</strong> Screen-capture protection keeps Clyde hidden on shared screens. Built-in stealth toggles instantly hide your app from the Taskbar and Alt+Tab menu.</li>
            <li><strong style={{ color: '#00f5ff' }}>Outcome-Based Trends:</strong> Learns from interview results to refine future tailoring, building an increasingly smarter job search engine.</li>
          </ul>
        </div>

      </div>

      {/* Synergistic Loop Callout */}
      <div style={{ maxWidth: '800px', margin: '40px auto 0 auto', padding: '24px 32px', background: 'rgba(0, 245, 255, 0.03)', border: '1px solid rgba(0, 245, 255, 0.12)', borderRadius: '16px', textAlign: 'center', boxSizing: 'border-box' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: '#fff', fontWeight: '700' }}>🔄 The Automated Career Loop</h4>
        <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--muted)', lineHeight: '1.6' }}>
          <strong>Clyde Go</strong> clips the role, refines your resume, and submits your application in under 30 seconds. 
          The application triggers a live call ➡️ <strong>Clyde Desktop</strong> springs to life, reads the clipped context, and silently feeds you the winning STAR-method answers on the fly. 
          Use them together to completely automate your job search.
        </p>
      </div>
    </section>
  );
}

function LandingPage({ navigate, onDownload }) {
  return (
    <main>
      <section className="hero-section">
        <HeroScene />
        <div className="hero-copy" data-reveal>
          <div className="hero-logo-lockup"><img src="/green_eyes_and_headphones.svg" alt="Clyde" /></div>
          <h1>The Undetectable Agentic Interview Copilot</h1>
          <p>
            Elevating professional execution with private, autonomous intelligence and real-time mastery.
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

      <FullOverlayShowcase />

      <ClydeGoPairingSection />

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

      <AboutClydeSection />

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

function PricingPage({ showUpgradeNotice, navigate }) {
  const [annual, setAnnual] = useState(true);
  const [proCheckout, setProCheckout] = useState({ open: false, email: '', busy: false, error: '', notice: '' });
  const [creditsCheckout, setCreditsCheckout] = useState({ open: false, email: '', busy: false, error: '', notice: '' });
  const [byokCheckout, setByokCheckout] = useState({ open: false, email: '', busy: false, error: '', notice: '' });
  const [selectedCreditsSize, setSelectedCreditsSize] = useState(50); // 20, 50, 120
  
  // Custom states for the Web Create Account modal
  const [signupModal, setSignupModal] = useState({ open: false, email: '', password: '', confirmPassword: '', busy: false, error: '', checkoutType: 'pro' });

  async function startProCheckout(event) {
    event.preventDefault();
    const email = proCheckout.email.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setProCheckout((s) => ({ ...s, error: 'Enter a valid email address.', notice: '' }));
      return;
    }
    setProCheckout((s) => ({ ...s, busy: true, error: '', notice: '' }));
    try {
      // 1. Check if user already exists
      const existRes = await fetch('/api/check-email-existence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const existPayload = await existRes.json().catch(() => ({}));
      
      if (existPayload.exists) {
        // If they already exist, continue directly to checkout as we do now
        const response = await fetch('/api/create-pro-signup-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, billingPeriod: annual ? 'annual' : 'monthly', forceCheckout: true })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.url) {
          throw new Error(payload.error || 'Checkout could not be started. Please try again.');
        }
        window.location.href = payload.url;
      } else {
        // If it's a new user, prompt them with the Create Account password modal!
        setProCheckout((s) => ({ ...s, busy: false }));
        setSignupModal({ open: true, email, password: '', confirmPassword: '', busy: false, error: '', checkoutType: 'pro' });
      }
    } catch (error) {
      setProCheckout((s) => ({ ...s, busy: false, error: error.message || 'Checkout could not be started.' }));
    }
  }

  async function handleWebSignupSubmit(event) {
    event.preventDefault();
    if (signupModal.password !== signupModal.confirmPassword) {
      setSignupModal((s) => ({ ...s, error: 'Passwords do not match.' }));
      return;
    }
    if (signupModal.password.length < 6) {
      setSignupModal((s) => ({ ...s, error: 'Password must be at least 6 characters.' }));
      return;
    }
    setSignupModal((s) => ({ ...s, busy: true, error: '' }));
    try {
      // Create user account in supabase directly from the website!
      const signUpResponse = await fetch('/api/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: signupModal.email, password: signupModal.password })
      });
      const signUpPayload = await signUpResponse.json().catch(() => ({}));
      if (!signUpResponse.ok) {
        throw new Error(signUpPayload.error || 'Account creation failed.');
      }

      // Automatically launch Stripe checkout immediately after account is successfully created!
      if (signupModal.checkoutType === 'credits') {
        const checkoutResponse = await fetch('/api/create-credits-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: signupModal.email, creditsAmount: selectedCreditsSize, forceCheckout: true })
        });
        const checkoutPayload = await checkoutResponse.json().catch(() => ({}));
        if (!checkoutResponse.ok || !checkoutPayload.url) {
          throw new Error(checkoutPayload.error || 'Credits checkout redirect failed.');
        }
        window.location.href = checkoutPayload.url;
      } else if (signupModal.checkoutType === 'byok') {
        const checkoutResponse = await fetch('/api/create-byok-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: signupModal.email, forceCheckout: true })
        });
        const checkoutPayload = await checkoutResponse.json().catch(() => ({}));
        if (!checkoutResponse.ok || !checkoutPayload.url) {
          throw new Error(checkoutPayload.error || 'BYOK checkout redirect failed.');
        }
        window.location.href = checkoutPayload.url;
      } else {
        const checkoutResponse = await fetch('/api/create-pro-signup-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: signupModal.email, billingPeriod: annual ? 'annual' : 'monthly', forceCheckout: true })
        });
        const checkoutPayload = await checkoutResponse.json().catch(() => ({}));
        if (!checkoutResponse.ok || !checkoutPayload.url) {
          throw new Error(checkoutPayload.error || 'Checkout redirect failed.');
        }
        window.location.href = checkoutPayload.url;
      }
    } catch (error) {
      setSignupModal((s) => ({ ...s, busy: false, error: error.message }));
    }
  }

  async function startCreditsCheckout(event) {
    event.preventDefault();
    const email = creditsCheckout.email.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setCreditsCheckout((s) => ({ ...s, error: 'Enter a valid email address.', notice: '' }));
      return;
    }
    setCreditsCheckout((s) => ({ ...s, busy: true, error: '', notice: '' }));
    try {
      // 1. Check if user already exists
      const existRes = await fetch('/api/check-email-existence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const existPayload = await existRes.json().catch(() => ({}));

      if (existPayload.exists) {
        // If they already exist, continue directly to credits checkout (force to bypass registration check in billing.js)
        const response = await fetch('/api/create-credits-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, creditsAmount: selectedCreditsSize, forceCheckout: true })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.url) {
          throw new Error(payload.error || 'Credits checkout could not be started. Please try again.');
        }
        window.location.href = payload.url;
      } else {
        // If it's a new user, prompt them with the Create Account password modal first!
        setCreditsCheckout((s) => ({ ...s, busy: false }));
        setSignupModal({ open: true, email, password: '', confirmPassword: '', busy: false, error: '', checkoutType: 'credits' });
      }
    } catch (error) {
      setCreditsCheckout((s) => ({ ...s, busy: false, error: error.message || 'Checkout could not be started.' }));
    }
  }

  async function startByokCheckout(event) {
    event.preventDefault();
    const email = byokCheckout.email.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setByokCheckout((s) => ({ ...s, error: 'Enter a valid email address.', notice: '' }));
      return;
    }
    setByokCheckout((s) => ({ ...s, busy: true, error: '', notice: '' }));
    try {
      const existRes = await fetch('/api/check-email-existence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const existPayload = await existRes.json().catch(() => ({}));

      if (existPayload.exists) {
        const response = await fetch('/api/create-byok-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, forceCheckout: true })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.url) {
          throw new Error(payload.error || 'BYOK checkout could not be started. Please try again.');
        }
        window.location.href = payload.url;
      } else {
        setByokCheckout((s) => ({ ...s, busy: false }));
        setSignupModal({ open: true, email, password: '', confirmPassword: '', busy: false, error: '', checkoutType: 'byok' });
      }
    } catch (error) {
      setByokCheckout((s) => ({ ...s, busy: false, error: error.message || 'Checkout could not be started.' }));
    }
  }

  const tiers = [
    {
      name: 'Free',
      priceMonthly: 0,
      priceAnnual: 0,
      description: 'Start with Clyde Assistant: floating chat, active-context questions, basic context, and secure private operation.',
      cta: 'Download Free',
      ctaClass: 'secondary',
      features: [
        { label: 'Undetectable floating HUD', free: true, pro: true, credits: true },
        { label: 'Active-context help', free: true, pro: true, credits: true },
        { label: 'Private & local operation', free: true, pro: true, credits: true },
        { label: 'Meeting notes & action items', free: true, pro: true, credits: true },
        { label: 'RAG across old sessions', free: false, pro: true, credits: false },
        { label: 'Broad conversation memory', free: false, pro: true, credits: false },
        { label: 'Gmail & Calendar scanning', free: false, pro: true, credits: false },
        { label: 'Autonomous opportunity updates', free: false, pro: true, credits: false },
        { label: '0-100 rating scorecards', free: false, pro: true, credits: false },
        { label: 'Phase trend analysis', free: false, pro: true, credits: false }
      ],
    },
    {
      name: 'Pro',
      priceMonthly: 29.99,
      priceAnnual: 24.99,
      description: 'Unlock Clyde Pro Agent: deeper memory, RAG across sessions, inbox scans, mock interview scorecards, and calibrated trends.',
      cta: 'Get Clyde Pro',
      ctaClass: 'primary',
      popular: true,
      features: [
        { label: 'Undetectable floating HUD', free: true, pro: true, credits: true },
        { label: 'Active-context help', free: true, pro: true, credits: true },
        { label: 'Private & local operation', free: true, pro: true, credits: true },
        { label: 'Meeting notes & action items', free: true, pro: true, credits: true },
        { label: 'RAG across old sessions', free: false, pro: true, credits: false },
        { label: 'Broad conversation memory', free: false, pro: true, credits: false },
        { label: 'Gmail & Calendar scanning', free: false, pro: true, credits: false },
        { label: 'Autonomous opportunity updates', free: false, pro: true, credits: false },
        { label: '0-100 rating scorecards', free: false, pro: true, credits: false },
        { label: 'Phase trend analysis', free: false, pro: true, credits: false }
      ],
    },
    {
      name: 'Credit Pack',
      key: 'credits',
      priceMonthly: selectedCreditsSize === 20 ? 4.99 : selectedCreditsSize === 120 ? 19.99 : 9.99,
      priceAnnual: selectedCreditsSize === 20 ? 4.99 : selectedCreditsSize === 120 ? 19.99 : 9.99,
      description: 'Buy on-demand background credits for the Clyde Go extension & mock interviews.',
      cta: `Buy Credit Pack (${selectedCreditsSize})`,
      ctaClass: 'primary',
      credits: true,
      features: [
        { label: `${selectedCreditsSize} background credits included`, free: false, pro: false, credits: true, byok: false },
        { label: 'Active-context filler', free: false, pro: false, credits: true, byok: false },
        { label: 'Extension & Mock Interview usage', free: false, pro: false, credits: true, byok: false },
        { label: 'Never expires', free: false, pro: false, credits: true, byok: false }
      ]
    },
    {
      name: 'BYOK Lifetime',
      key: 'byok',
      priceMonthly: 99.00,
      priceAnnual: 99.00,
      description: 'One-time payment for offline local-only Pro features. Bring your own Gemini/OpenAI API keys.',
      cta: 'Get BYOK Lifetime',
      ctaClass: 'primary',
      byok: true,
      features: [
        { label: 'Undetectable floating HUD', free: true, pro: true, credits: true, byok: true },
        { label: 'Active-context help', free: true, pro: true, credits: true, byok: true },
        { label: 'Private & local operation', free: true, pro: true, credits: true, byok: true },
        { label: 'Meeting notes & action items', free: true, pro: true, credits: true, byok: true },
        { label: 'RAG across old sessions (Local)', free: false, pro: true, credits: false, byok: true },
        { label: 'Broad conversation memory (Local)', free: false, pro: true, credits: false, byok: true },
        { label: 'Gmail & Calendar scanning (Local)', free: false, pro: true, credits: false, byok: true },
        { label: '0-100 rating scorecards (Local)', free: false, pro: true, credits: false, byok: true },
        { label: 'Phase trend analysis (Local)', free: false, pro: true, credits: false, byok: true }
      ]
    }
  ];

  const price = (tier) => {
    if (tier.priceMonthly === 0) return 'Free';
    if (tier.name === 'Credit Pack') {
      return (
        <>
          <span className="currency">$</span>{tier.priceMonthly}
        </>
      );
    }
    const amount = annual ? tier.priceAnnual : tier.priceMonthly;
    return (
      <>
        <span className="currency">$</span>{amount}
      </>
    );
  };

  const period = (tier) => {
    if (tier.priceMonthly === 0) return '';
    if (tier.name === 'Credit Pack') return 'one-time purchase';
    return annual ? '/month, billed annually' : '/month';
  };

  return (
    <main>
      <section className="pricing-section">
        <div className="pricing-header" data-reveal>
          <h1>Sleek, Private AI for your Job Search.</h1>
          <p>Start with Clyde Assistant, or unlock the agentic layer with Clyde Pro.</p>
        </div>

        {/* Billing Toggle */}
        <div className="billing-toggle" data-reveal>
          <button className={!annual ? 'active' : ''} onClick={() => setAnnual(false)}>
            Monthly
          </button>
          <button className={annual ? 'active' : ''} onClick={() => setAnnual(true)}>
            Annual
            <span className="discount-badge">Save 16%</span>
          </button>
        </div>

        {/* Pricing Cards */}
        <div className="pricing-grid" data-reveal>
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`pricing-card glass-card ${tier.name === 'Pro' ? 'pro' : ''}`}
            >
              {tier.popular ? <span className="popular-badge">Most Popular</span> : null}
              <div className="tier-name">{tier.name}</div>
              <div className="price">{price(tier)}</div>
              <div className="price-period">{period(tier)}</div>
              {tier.name === 'Credit Pack' && (
                <div style={{ margin: '8px 0 16px 0', display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'center', width: '100%' }}>
                  <select 
                    value={selectedCreditsSize} 
                    onChange={(e) => setSelectedCreditsSize(Number(e.target.value))}
                    style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '8px 12px', color: '#f8fafc', width: '100%', outline: 'none', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'center', boxSizing: 'border-box' }}
                  >
                    <option value="20">20 Credits — $4.99</option>
                    <option value="50">50 Credits — $9.99</option>
                    <option value="120">120 Credits — $19.99</option>
                  </select>
                </div>
              )}
              <div className="description">{tier.description}</div>

              <ul className="feature-list">
                {tier.features.map((feat, i) => {
                  const checkKey = tier.key || tier.name.toLowerCase();
                  const hasFeature = feat[checkKey];
                  return (
                    <li key={i}>
                      {hasFeature ? (
                        <span className={`check ${checkKey}`}>✓</span>
                      ) : (
                        <span className="check free" style={{ background: 'transparent', color: 'var(--muted-2)' }}>–</span>
                      )}
                      {feat.label}
                    </li>
                  );
                })}
              </ul>

              {tier.name === 'Pro' && proCheckout.open ? (
                <form className="pro-checkout-form" onSubmit={startProCheckout}>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="you@email.com"
                    value={proCheckout.email}
                    disabled={proCheckout.busy}
                    autoFocus
                    onChange={(event) => setProCheckout((s) => ({ ...s, email: event.target.value }))}
                  />
                  <button className={`cta-btn ${tier.ctaClass}`} type="submit" disabled={proCheckout.busy}>
                    {proCheckout.busy ? <span className="btn-spinner" aria-hidden="true" /> : null}
                    {proCheckout.busy ? 'Opening checkout...' : `Continue to Checkout (${annual ? 'Annual' : 'Monthly'})`}
                  </button>
                  {proCheckout.error ? (
                    <p className="checkout-status checkout-error">
                      {proCheckout.error}{' '}
                      {(proCheckout.error.toLowerCase().includes('registered') || proCheckout.error.toLowerCase().includes('exists')) && (
                        <a href="/forgot-password" onClick={(e) => { e.preventDefault(); navigate('/forgot-password'); }} style={{ color: '#6366f1', textDecoration: 'underline', marginLeft: '4px' }}>Reset password</a>
                      )}
                    </p>
                  ) : null}
                  {proCheckout.notice ? <p className="checkout-status">{proCheckout.notice}</p> : null}
                </form>
              ) : tier.name === 'Credit Pack' && creditsCheckout.open ? (
                <form className="pro-checkout-form" onSubmit={startCreditsCheckout}>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="you@email.com"
                    value={creditsCheckout.email}
                    disabled={creditsCheckout.busy}
                    autoFocus
                    onChange={(event) => setCreditsCheckout((s) => ({ ...s, email: event.target.value }))}
                  />
                  <button className={`cta-btn ${tier.ctaClass}`} type="submit" disabled={creditsCheckout.busy}>
                    {creditsCheckout.busy ? <span className="btn-spinner" aria-hidden="true" /> : null}
                    {creditsCheckout.busy ? 'Opening checkout...' : 'Continue to Checkout'}
                  </button>
                  {creditsCheckout.error ? (
                    <p className="checkout-status checkout-error">
                      {creditsCheckout.error}{' '}
                      {(creditsCheckout.error.toLowerCase().includes('registered') || creditsCheckout.error.toLowerCase().includes('exists')) && (
                        <a href="/forgot-password" onClick={(e) => { e.preventDefault(); navigate('/forgot-password'); }} style={{ color: '#6366f1', textDecoration: 'underline', marginLeft: '4px' }}>Reset password</a>
                      )}
                    </p>
                  ) : null}
                </form>
              ) : tier.name === 'BYOK Lifetime' && byokCheckout.open ? (
                <form className="pro-checkout-form" onSubmit={startByokCheckout}>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="you@email.com"
                    value={byokCheckout.email}
                    disabled={byokCheckout.busy}
                    autoFocus
                    onChange={(event) => setByokCheckout((s) => ({ ...s, email: event.target.value }))}
                  />
                  <button className={`cta-btn ${tier.ctaClass}`} type="submit" disabled={byokCheckout.busy}>
                    {byokCheckout.busy ? <span className="btn-spinner" aria-hidden="true" /> : null}
                    {byokCheckout.busy ? 'Opening checkout...' : 'Continue to Checkout'}
                  </button>
                  {byokCheckout.error ? (
                    <p className="checkout-status checkout-error">
                      {byokCheckout.error}{' '}
                      {(byokCheckout.error.toLowerCase().includes('registered') || byokCheckout.error.toLowerCase().includes('exists')) && (
                        <a href="/forgot-password" onClick={(e) => { e.preventDefault(); navigate('/forgot-password'); }} style={{ color: '#6366f1', textDecoration: 'underline', marginLeft: '4px' }}>Reset password</a>
                      )}
                    </p>
                  ) : null}
                </form>
              ) : (
                <button
                  className={`cta-btn ${tier.ctaClass}`}
                  onClick={() => {
                    if (tier.name === 'Pro') {
                      setProCheckout((s) => ({ ...s, open: true, error: '', notice: '' }));
                    } else if (tier.name === 'Credit Pack') {
                      setCreditsCheckout((s) => ({ ...s, open: true, error: '', notice: '' }));
                    } else if (tier.name === 'BYOK Lifetime') {
                      setByokCheckout((s) => ({ ...s, open: true, error: '', notice: '' }));
                    } else {
                      window.location.href = downloadHref;
                    }
                  }}
                >
                  {tier.cta}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Web Create Account Modal */}
      {signupModal.open ? (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(16px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#f8fafc',
          fontFamily: 'system-ui, sans-serif',
          padding: '16px'
        }}>
          <div style={{
            background: 'rgba(30, 41, 59, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '32px',
            width: '100%',
            maxWidth: '380px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            textAlign: 'center',
            position: 'relative'
          }}>
            <button
              onClick={() => setSignupModal((s) => ({ ...s, open: false }))}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                fontSize: '1.5rem',
                cursor: 'pointer'
              }}
            >
              ×
            </button>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 'bold', marginBottom: '8px', color: '#f8fafc' }}>
              Create Account
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '24px' }}>
              Choose a secure password for your new Clyde account.
            </p>

            <form onSubmit={handleWebSignupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: '#cbd5e1' }}>
                Email Address
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={signupModal.email}
                  onChange={(e) => setSignupModal((s) => ({ ...s, email: e.target.value }))}
                  style={{
                    background: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    color: '#f8fafc',
                    fontSize: '0.9rem',
                    outline: 'none',
                    cursor: 'text'
                  }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: '#cbd5e1' }}>
                Password
                <input
                  type="password"
                  required
                  autoFocus
                  autoComplete="new-password"
                  disabled={signupModal.busy}
                  value={signupModal.password}
                  onChange={(e) => setSignupModal({ ...signupModal, password: e.target.value })}
                  style={{
                    background: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    color: '#f8fafc',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: '#cbd5e1' }}>
                Confirm Password
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  disabled={signupModal.busy}
                  value={signupModal.confirmPassword}
                  onChange={(e) => setSignupModal({ ...signupModal, confirmPassword: e.target.value })}
                  style={{
                    background: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    color: '#f8fafc',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </label>

              {signupModal.error ? (
                <p style={{ fontSize: '0.8rem', color: '#ef4444', margin: '4px 0', textAlign: 'center', lineHeight: '1.4' }}>
                  {signupModal.error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={signupModal.busy}
                style={{
                  background: 'linear-gradient(to right, #6366f1, #a855f7)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px',
                  color: '#ffffff',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  cursor: signupModal.busy ? 'wait' : 'pointer',
                  marginTop: '8px',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                  transition: 'opacity 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {signupModal.busy ? <span className="btn-spinner" aria-hidden="true" /> : null}
                {signupModal.busy ? 'Creating account...' : 'Create Account'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '12px' }}>
                <a
                  href="/forgot-password"
                  onClick={(e) => {
                    e.preventDefault();
                    setSignupModal((s) => ({ ...s, open: false }));
                    navigate('/forgot-password');
                  }}
                  style={{
                    color: '#6366f1',
                    fontSize: '0.8rem',
                    textDecoration: 'underline',
                    cursor: 'pointer'
                  }}
                >
                  Forgot Password?
                </a>
              </div>
            </form>
          </div>
        </div>
      ) : null}
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

function ClydeGoPage() {
  return (
    <main>
      <section className="subpage-hero">
        <div className="subpage-copy" data-reveal>
          <span className="eyebrow">Clyde Go Chrome Extension</span>
          <h1>Your Job Application Command Center.</h1>
          <p>
            An AI-powered extension built to source jobs, match resumes, generate customized application documents, and auto-fill ATS portals with Gemini-driven DOM automation.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href="#autofill">See Autofill in Action</a>
          </div>
        </div>
        <figure className="large-product-figure" data-reveal>
          <img src="/Clyde Extension Screenshots/clyde-extension-main-UI.svg" alt="Clyde Go Extension Sidebar UI" />
        </figure>
      </section>

      <div className="logo-ticker-container ats-ticker-container" style={{ padding: '40px 0 20px 0', marginTop: '-40px', marginBottom: '40px' }} data-reveal>
        <p className="logo-ticker-title" style={{ fontSize: '0.85rem', marginBottom: '20px', letterSpacing: '1.5px' }}>Compatible ATS Platforms</p>
        <div className="logo-ticker">
          <div className="logo-ticker-track">
            {['greenhouse.svg', 'ashby.svg', 'lever.svg', 'workday.svg', 'smartrecruiters.svg', 'icims.svg', 'linkedin.svg', 'taleo.svg'].map((logo, i) => (
              <img key={`ats-1-${i}`} src={`/ATS Company Logos/${logo}`} alt="ATS Logo" />
            ))}
            {['greenhouse.svg', 'ashby.svg', 'lever.svg', 'workday.svg', 'smartrecruiters.svg', 'icims.svg', 'linkedin.svg', 'taleo.svg'].map((logo, i) => (
              <img key={`ats-2-${i}`} src={`/ATS Company Logos/${logo}`} alt="ATS Logo" />
            ))}
          </div>
        </div>
      </div>

      <section className="section-band privacy-band" id="sourcing" data-reveal>
        <div className="privacy-copy">
          <span className="eyebrow">Job Sourcing & Matching</span>
          <h2>Instant clipping & Match Score.</h2>
          <p>
            Highlight job descriptions on any web page (LinkedIn, Indeed, etc.), right-click, and select "Save to Clyde". 
            Clyde Go analyzes the role against your Master Resume, delivering a 5.0 Match Score, listing key strengths, identifying candidate gaps, and detailing interview mitigations.
          </p>
        </div>
        <figure className="large-product-figure">
          <img src="/Clyde Extension Screenshots/clyde-extension-context-menu-options.svg" alt="Right-click context menu options for Clyde Go" />
        </figure>
      </section>

      <section className="section-band privacy-band" id="autofill" data-reveal>
        <figure className="large-product-figure">
          <video 
            src="/Clyde Extension Screenshots/autofill-example.mp4" 
            controls 
            autoPlay 
            muted 
            loop 
            playsInline
            style={{ width: '100%', borderRadius: '12px', display: 'block' }}
          />
        </figure>
        <div className="privacy-copy">
          <span className="eyebrow">DOM Automation</span>
          <h2>AI Apply: One-click portal filling.</h2>
          <p>
            Clyde Go parses application fields on major ATS platforms including Greenhouse, Ashby, Lever, and Workday. 
            With a click of the "AI Apply" button, it fills form inputs, dynamically answers custom application questions using your resume details, and generates an ATS-ready PDF resume.
          </p>
        </div>
      </section>

      <section className="section-band product-band" id="docs" data-reveal>
        <div className="section-heading compact">
          <span className="eyebrow">Generative Engine</span>
          <h2>Tailored resumes & cover letters.</h2>
          <p>Generate matching documents formatted for ATS systems that reflect the exact vocabulary of the job description.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '32px' }} className="responsive-docs-grid">
          <figure className="large-product-figure">
            <img src="/Clyde Extension Screenshots/tailored-docs.svg" alt="Tailored Documents generated by Clyde Go" />
            <figcaption className="video-caption">Tailor your profile to highlight role-specific strengths.</figcaption>
          </figure>
          <figure className="large-product-figure">
            <img src="/Clyde Extension Screenshots/cover-letter-preview.svg" alt="Cover Letter Preview in Clyde Go" />
            <figcaption className="video-caption">Generate high-converting, metric-driven cover letters.</figcaption>
          </figure>
        </div>
      </section>
    </main>
  );
}

const policySections = [
  {
    title: 'Information Clyde collects',
    body: [
      'Account and billing information: email address, account identifiers, subscription tier, entitlement status, customer ID, and support messages. Payments are processed by Stripe. Clyde does not store full card numbers.',
      'Desktop app information: settings, selected audio devices, current company and role, opportunities, meetings, transcripts, notes, scorecards, knowledge files, pinned sources, app actions, and local logs.',
      'Optional connected data: Google account details, Gmail and Google Calendar content needed for user-requested sync, OAuth tokens, provider API keys, uploaded files, audio, screenshots, transcript text, and AI request content when you enable those features.',
      'Website and service information: IP address, browser type, checkout events, download events, server logs, and basic analytics if analytics are enabled.'
    ]
  },
  {
    title: 'How Clyde uses information',
    body: [
      'Clyde uses information to run the desktop assistant, create transcripts and notes, answer questions, search saved context, generate scorecards, sync user-approved Google updates, process subscriptions, enforce Free and Pro tier access, prevent abuse, fix bugs, and respond to support requests.',
      'Clyde does not sell personal information and does not use Google user data for advertising.'
    ]
  },
  {
    title: 'When information is disclosed',
    body: [
      'Clyde discloses information to service providers only when needed to operate the product. These providers can include hosting, database, authentication, billing, AI, transcription, vector search, email, support, and analytics providers.',
      'If you connect Google, Clyde uses Google data only for the user-facing features you choose, such as reading interview-related signals, proposing updates, and updating Clyde records. Clyde may disclose information when required by law, to protect Clyde or users, during a business transfer, or when you direct Clyde to send or export something.'
    ]
  },
  {
    title: 'Method of disclosure',
    body: [
      'Clyde sends information through encrypted HTTPS/TLS API requests, OAuth-authorized Google API requests, Stripe Checkout and Customer Portal redirects, app-to-server entitlement checks, and user-initiated exports or uploads.',
      'Desktop data is stored locally by default. Data leaves your device when you enable a cloud provider, connect an account, use billing, use sync, request support that includes diagnostic content, or submit website forms.'
    ]
  },
  {
    title: 'Security practices',
    body: [
      'Clyde uses HTTPS for network requests, OAuth for Google access, limited Google scopes, server-side environment secrets, Stripe-hosted payment collection, and access controls for production systems.',
      'Provider keys supplied in the desktop app are stored locally on your device unless a feature explicitly needs a server-side request. Clyde limits internal access to operational needs and removes obsolete demo settings from production use.'
    ]
  },
  {
    title: 'Retention and deletion',
    body: [
      'Local desktop data remains on your device until you delete it in the app, clear the app data folder, or uninstall Clyde. Account, billing, and security records are retained as needed for subscriptions, tax, fraud prevention, legal obligations, and support history.',
      'You can disconnect Google access, cancel Pro, delete local records, and request account deletion by contacting Clyde.'
    ]
  },
  {
    title: 'Google API Limited Use',
    body: [
      'Clyde uses Google user data only to provide and improve user-facing sync and assistant features inside Clyde. Clyde does not sell Google user data, use it for ads, or use it to train generalized AI models.',
      'Clyde follows the Google API Services User Data Policy, including the Limited Use requirements.'
    ]
  },
  {
    title: 'Children, changes, and contact',
    body: [
      'Clyde is intended for users who are at least 13 years old. Clyde may update this policy when the product, legal requirements, or service providers change.',
      'Questions, deletion requests, and privacy requests can be sent to support@clydeai.live.'
    ]
  }
];

function PrivacyPolicyPage() {
  return (
    <main className="privacy-policy-page">
      <section className="subpage-hero policy-hero">
        <div className="subpage-copy" data-reveal>
          <span className="eyebrow">Legal</span>
          <h1>Privacy policy</h1>
          <p>
            This policy explains what Clyde collects, how Clyde uses it, when it is disclosed, how disclosure happens,
            and the security practices used to protect it.
          </p>
          <p className="policy-effective">Last updated: May 25, 2026</p>
        </div>
        <aside className="policy-summary-card" data-reveal>
          <h2>Short version</h2>
          <p>Clyde stores app data locally by default and sends data to cloud services only for the features you enable.</p>
          <p>Pro billing runs through Stripe. Google data is used only for Clyde sync and assistant features.</p>
          <a className="secondary-link" href="mailto:support@clydeai.live">Contact privacy support</a>
        </aside>
      </section>

      <section className="section-band policy-body" data-reveal>
        <div className="policy-intro">
          <h2>Clyde privacy terms</h2>
          <p>
            Clyde is a desktop assistant for interviews, meetings, preparation, and follow-up. The desktop app can run with local data,
            local models, cloud AI providers, Google sync, website billing, and Pro entitlement checks depending on your settings.
          </p>
        </div>
        <div className="policy-grid">
          {policySections.map((section) => (
            <article className="policy-section" key={section.title}>
              <h3>{section.title}</h3>
              {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function ForgotPasswordPage({ navigate }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleResetSubmit(event) {
    event.preventDefault();
    const targetEmail = email.trim();
    if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    setStatus('');
    setError('');
    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Password reset failed.');
      }
      setStatus('Password reset email sent successfully! Please check your inbox (including spam) for the reset link.');
      setEmail('');
    } catch (err) {
      setError(err.message || 'Password reset failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-confirmed-page">
      <section className="subpage-hero policy-hero">
        <div className="subpage-copy is-visible">
          <span className="eyebrow">Account Security</span>
          <h1>Reset your Clyde password</h1>
          <p>Enter the email address associated with your Clyde account, and we will send you a secure link to reset your password.</p>
          
          <form className="auth-password-form" onSubmit={handleResetSubmit} style={{ marginTop: '24px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', color: '#cbd5e1' }}>
              Email Address
              <input
                type="email"
                required
                autoComplete="email"
                disabled={busy}
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@email.com"
                style={{
                  background: '#0f172a',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '12px',
                  color: '#f8fafc',
                  fontSize: '0.95rem',
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
            </label>
            <button
              className="primary-link"
              type="submit"
              disabled={busy}
              style={{
                background: 'linear-gradient(to right, #6366f1, #a855f7)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '14px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: busy ? 'wait' : 'pointer',
                marginTop: '16px',
                width: '100%',
                boxSizing: 'border-box',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {busy ? <span className="btn-spinner" aria-hidden="true" /> : null}
              {busy ? 'Sending link...' : 'Send Reset Link'}
            </button>
            {error ? <p className="auth-status" style={{ color: '#ef4444', marginTop: '12px' }}>{error}</p> : null}
            {status ? <p className="auth-status" style={{ color: '#10b981', marginTop: '12px' }}>{status}</p> : null}
          </form>
        </div>
        <aside className="policy-summary-card is-visible">
          <h2>Sign In Help</h2>
          <p>
            After resetting your password, you can sign in directly to the Clyde Desktop app.
          </p>
          <p style={{ marginTop: '12px', fontSize: '0.85rem', color: '#94a3b8' }}>
            Need further help? Visit our <a href="/support" onClick={(e) => { e.preventDefault(); navigate('/support'); }} style={{ color: '#6366f1', textDecoration: 'underline' }}>Support Page</a>.
          </p>
        </aside>
      </section>
    </main>
  );
}

function AuthConfirmedPage() {
  const [token, setToken] = useState('');
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    setToken(params.get('access_token') || '');
  }, []);

  async function completeInvite(event) {
    event.preventDefault();
    if (!form.password || form.password !== form.confirmPassword) {
      setStatus('Enter matching passwords.');
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      const response = await fetch('/api/complete-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token, password: form.password })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Password setup failed.');
      }
      setStatus('Password saved successfully! You are ready to log in.');
    } catch (error) {
      setStatus(error.message || 'Password setup failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-confirmed-page">
      <section className="subpage-hero policy-hero">
        <div className="subpage-copy is-visible">
          <span className="eyebrow">Account</span>
          <h1>{token ? 'Set your Clyde password' : 'Email verified!'}</h1>
          <p>{token ? 'Create the password you will use to sign in to Clyde desktop.' : 'Your Clyde account email has been successfully verified! You can safely close this browser window and return to the Clyde Desktop app to sign in.'}</p>
          {token ? (
            <form className="auth-password-form" onSubmit={completeInvite}>
              <label>Password<input type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} /></label>
              <label>Confirm password<input type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))} /></label>
              <button className="primary-link" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save password'}</button>
              {status ? <p className="auth-status">{status}</p> : null}
            </form>
          ) : null}
        </div>
        <aside className="policy-summary-card is-visible">
          <h2>Next step</h2>
          <p>{token ? 'After saving your password, open Clyde and sign in from onboarding or Settings.' : '1. Open the Clyde Desktop app. 2. Log in using your email and password. 3. Complete your onboarding!'}</p>
        </aside>
      </section>
    </main>
  );
}

function BillingSuccessPage() {
  const [activation, setActivation] = useState({ status: 'working', message: 'Activating your Pro account...', invited: false });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id') || '';
    if (!sessionId) {
      setActivation({ status: 'error', message: 'Missing Stripe checkout session. Contact support with the email used at checkout.', invited: false });
      return;
    }

    let cancelled = false;
    fetch('/api/activate-pro-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || 'Pro activation failed.');
        }
        return payload;
      })
      .then((payload) => {
        if (cancelled) return;
        setActivation({
          status: 'success',
          message: `Pro is active for ${payload.email}.`,
          invited: Boolean(payload.invited)
        });

        // Report conversion to Microsoft Ads (UET)
        try {
          window.uetq = window.uetq || [];
          if (payload.email) {
            window.uetq.push('set', {
              'pid': {
                'em': payload.email
              }
            });
          }
          window.uetq.push('event', '', {
            'revenue_value': payload.amountTotal || 29.99,
            'currency': 'USD'
          });
          console.log("[UET] Reported purchase conversion successfully:", payload.amountTotal);
        } catch (e) {
          console.error("[UET] Microsoft tracking failed:", e);
        }

        // Report conversion to Google Analytics / Ads (GA4)
        try {
          window.gtag = window.gtag || function() { (window.dataLayer = window.dataLayer || []).push(arguments); };
          window.gtag('event', 'purchase', {
            transaction_id: sessionId,
            value: payload.amountTotal || 29.99,
            currency: 'USD',
            items: [{
              item_id: 'clyde_pro_subscription',
              item_name: 'Clyde Pro Subscription',
              price: payload.amountTotal || 29.99,
              quantity: 1
            }]
          });
          console.log("[Google] Reported purchase conversion successfully:", payload.amountTotal);
        } catch (e) {
          console.error("[Google] tracking failed:", e);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setActivation({ status: 'error', message: error.message || 'Pro activation failed.', invited: false });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="auth-confirmed-page">
      <section className="subpage-hero policy-hero">
        <div className="subpage-copy is-visible">
          <span className="eyebrow">Billing</span>
          <h1>Pro checkout complete</h1>
          <p>{activation.message}</p>
          {activation.status !== 'success' && (
            <a className="primary-link" href="/">Return Home</a>
          )}
        </div>
        <aside className="policy-summary-card is-visible">
          <h2>What to do next</h2>
          <p>{activation.status === 'working'
            ? 'This usually takes a few seconds.'
            : activation.status === 'error'
              ? 'If this keeps failing, contact support with the Stripe checkout email.'
              : 'Return to the Clyde Desktop app to sign in and complete your onboarding!'}</p>
        </aside>
      </section>
    </main>
  );
}

const termsSections = [
  {
    title: 'Using Clyde',
    body: [
      'Clyde is a desktop assistant for interviews, meetings, preparation, notes, and follow-up. You are responsible for using Clyde lawfully, following workplace, school, meeting, platform, and recording rules that apply to you.',
      'You must provide accurate account and billing information and keep your account credentials secure.'
    ]
  },
  {
    title: 'Free and Pro tiers',
    body: [
      'Clyde Assistant is the Free tier. It includes the free features shown in the app and on the website.',
      'Clyde Pro Agent is the Pro tier. Pro access requires an active subscription or active beta entitlement and includes the Pro features shown in the app and on the website. Clyde may change tier limits, prices, and included features for future billing periods.'
    ]
  },
  {
    title: 'Subscriptions and billing',
    body: [
      'Paid subscriptions are processed by Stripe. By starting a paid plan, you authorize recurring charges until you cancel. Taxes may apply.',
      'You can cancel through the billing portal or the method Clyde provides. Cancellation stops future renewal charges and does not automatically refund prior charges unless required by law or stated in a separate written policy.'
    ]
  },
  {
    title: 'Acceptable use',
    body: [
      'You may not use Clyde to break the law, violate third-party rights, bypass security controls, send spam, impersonate others, scrape services without permission, or generate harmful, fraudulent, or abusive content.',
      'You may not reverse engineer Clyde, interfere with Clyde services, overload infrastructure, or use Clyde to build a competing product from non-public product behavior.'
    ]
  },
  {
    title: 'Your content and connected services',
    body: [
      'You keep ownership of the files, transcripts, notes, account data, and other content you add to Clyde. You grant Clyde the permission needed to process that content to provide the product features you choose.',
      'When you connect Google, AI providers, transcription providers, or other services, their terms and privacy policies also apply.'
    ]
  },
  {
    title: 'AI output',
    body: [
      'Clyde can generate suggestions, answers, summaries, ratings, and analysis. You are responsible for reviewing output before relying on it or sending it to someone else.',
      'AI output may be incomplete, inaccurate, or inappropriate for a specific situation. Clyde does not provide legal, financial, medical, hiring, or professional advice.'
    ]
  },
  {
    title: 'Availability and changes',
    body: [
      'Clyde may release updates, change features, pause services, or stop supporting old versions. Some features depend on operating systems, meeting apps, model providers, Google APIs, Stripe, and network availability.',
      'Beta features may change more often and may have bugs, usage limits, or temporary outages.'
    ]
  },
  {
    title: 'Disclaimers and liability',
    body: [
      'Clyde is provided as available, subject to the warranties required by law. Clyde is not responsible for lost interviews, lost jobs, lost revenue, lost data, meeting rule violations, provider outages, or indirect damages to the fullest extent allowed by law.',
      'If Clyde is found liable for a claim, Clyde liability is limited to the amount you paid for Clyde in the 3 months before the event giving rise to the claim, unless the law requires a different limit.'
    ]
  },
  {
    title: 'Termination and contact',
    body: [
      'Clyde may suspend or terminate access if you violate these terms, create risk for Clyde or others, fail to pay, or use the product in a way that may cause legal or security problems.',
      'Questions about these terms can be sent to support@clydeai.live.'
    ]
  }
];

function TermsOfServicePage() {
  return (
    <main className="terms-page">
      <section className="subpage-hero policy-hero">
        <div className="subpage-copy" data-reveal>
          <span className="eyebrow">Legal</span>
          <h1>Terms of service</h1>
          <p>
            These terms govern access to Clyde Assistant, Clyde Pro Agent, the Clyde website, billing flows,
            desktop app features, connected services, and beta releases.
          </p>
          <p className="policy-effective">Last updated: May 25, 2026</p>
        </div>
        <aside className="policy-summary-card" data-reveal>
          <h2>Product terms</h2>
          <p>Use Clyde lawfully, review AI output before relying on it, and follow the rules for meetings and services you connect.</p>
          <p>Pro billing runs through Stripe and renews until canceled.</p>
          <a className="secondary-link" href="mailto:support@clydeai.live">Contact support</a>
        </aside>
      </section>

      <section className="section-band policy-body" data-reveal>
        <div className="policy-intro">
          <h2>Clyde terms</h2>
          <p>
            These terms are written for the current Clyde beta and production-readiness work. Replace or review them with counsel before broad public launch.
          </p>
        </div>
        <div className="policy-grid">
          {termsSections.map((section) => (
            <article className="policy-section" key={section.title}>
              <h3>{section.title}</h3>
              {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function FullOverlayShowcase() {
  const [isMobile, setIsMobile] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchEndX, setTouchEndX] = useState(0);

  const slides = [
    { src: '/Clyde Screenshots/google meet 2.svg', logo: '/logos/google meet logo.svg', caption: 'Google Meet' },
    { src: '/Clyde Screenshots/zoom 2.svg',        logo: '/logos/zoom logo.svg',        caption: 'zoom' },
    { src: '/Clyde Screenshots/teams 2.svg',       logo: '/logos/teams logo.svg',       caption: 'Teams' },
  ];

  const SWIPE_THRESHOLD = 50;

  useEffect(() => {
    const checkSize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  function goToSlide(index) {
    setCurrentSlide((index + slides.length) % slides.length);
  }

  function handleTouchStart(e) {
    setTouchStartX(e.touches[0].clientX);
  }

  function handleTouchMove(e) {
    setTouchEndX(e.touches[0].clientX);
  }

  function handleTouchEnd() {
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > SWIPE_THRESHOLD) {
      goToSlide(currentSlide + (diff > 0 ? 1 : -1));
    }
  }

  const tickerLogos = ['12.svg', '8.svg', '14.svg', '5.svg', 'apple.svg', '11.svg', '7.svg', '13.svg', '6.svg', '10.svg', '9.svg'];

  return (
    <section className="section-band full-overlay-band" data-reveal>
      <div className="logo-ticker-container">
        <p className="logo-ticker-title">Chosen By Top Candidates Worldwide</p>
        <div className="logo-ticker">
          <div className="logo-ticker-track">
            {tickerLogos.map((logo, i) => (
              <img key={`logo-1-${i}`} src={`/logos/company logos/${logo}`} alt="Company Logo" />
            ))}
            {tickerLogos.map((logo, i) => (
              <img key={`logo-2-${i}`} src={`/logos/company logos/${logo}`} alt="Company Logo" />
            ))}
          </div>
        </div>
      </div>
      <div className="full-overlay-copy">
        <span className="eyebrow">Live capture mode</span>
        <h2>Live answer cards that stay out of the way.</h2>
      </div>
      <figure className="full-overlay-figure">
        <div style={{ width: '100%', marginBottom: '36px' }}>
          {isMobile ? (
            <video 
              key="mobile-video"
              src="/Clyde Screenshots/website_mobile_vid.mp4" 
              controls 
              autoPlay 
              muted 
              loop 
              playsInline
              style={{ width: '100%', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.08)' }}
            />
          ) : (
            <video 
              key="desktop-video"
              src="/Clyde Screenshots/website_desktop_vid.mp4" 
              controls 
              autoPlay 
              muted 
              loop 
              playsInline
              style={{ width: '100%', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.08)' }}
            />
          )}
          <figcaption className="video-caption">
            Clyde can surface transparent, glanceable suggestions during a call so you get help without covering the meeting or breaking focus.
            It can also display relevant memory from RAG files, notes, or previous sessions beside the suggested answer.
          </figcaption>
        </div>

        {/* Platform Logo Above Carousel */}
        <div className="carousel-platform-header">
          <img 
            src={slides[currentSlide].logo} 
            alt={`${slides[currentSlide].caption} Logo`} 
            className="carousel-platform-logo" 
          />
        </div>

        {/* Carousel */}
        <div className="carousel-container"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="carousel-track" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
            {slides.map((slide, i) => (
              <div className="carousel-slide" key={i}>
                <img src={slide.src} alt={`Clyde overlay on ${slide.caption}`} className="carousel-screenshot" loading="lazy" />
              </div>
            ))}
          </div>

          {/* Arrow buttons */}
          <button className="carousel-arrow carousel-arrow--prev" type="button" onClick={() => goToSlide(currentSlide - 1)} aria-label="Previous screenshot">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button className="carousel-arrow carousel-arrow--next" type="button" onClick={() => goToSlide(currentSlide + 1)} aria-label="Next screenshot">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
          </button>

          {/* Dot indicators */}
          <div className="carousel-dots">
            {slides.map((_, i) => (
              <button
                key={i}
                className={`carousel-dot${i === currentSlide ? ' active' : ''}`}
                type="button"
                onClick={() => goToSlide(i)}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </div>
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
        <div className="transcript-pane">
          <p><strong>Interviewer</strong> How would you handle a vague product requirement?</p>
          <p><strong>Clyde</strong> Mention discovery, risk framing, stakeholder alignment, and a measurable next step.</p>
        </div>
      </div>
      <div className="floating-card answer-card">
        <span>Suggested answer</span>
        <p>Start with clarifying questions, define a minimal viable scope, and explain how you would validate with users.</p>
      </div>
      <div className="floating-card prep-card">
        <span>Active context</span>
        <p>Prior round notes: focus on leadership style, cross-functional alignment, and scaling challenges.</p>
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
  const [upgradeNotice, setUpgradeNotice] = useState('');

  function showUpgradeNotice() {
    setUpgradeNotice('Open Clyde desktop, sign in, then use Settings > Account > Get Clyde Pro.');
  }

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
              {tier.name === 'Pro' ? (
                <button className="primary-link tier-action" type="button" onClick={showUpgradeNotice}>
                  Get Clyde Pro
                </button>
              ) : (
                <a className="secondary-link tier-action" href={downloadHref}>
                  Download Free
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
      {upgradeNotice ? <p className="checkout-status">{upgradeNotice}</p> : null}
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
      // Explicitly request user microphone access before booting LiveKit WebRTC
      await navigator.mediaDevices.getUserMedia({ audio: true }).catch((err) => {
        console.error('Mic request failed:', err);
        throw new Error('Microphone access is required. Please check your browser permissions.');
      });

      const response = await fetch('/api/liveavatar-token', { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.sessionToken) {
        throw new Error(payload.error || 'LiveAvatar token endpoint is not available.');
      }

      const session = new LiveAvatarSession(payload.sessionToken, { voiceChat: true });
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

function AboutClydeSection() {
  return (
    <section className="section-band about-band" id="about" data-reveal>
      <div className="section-heading">
        <span className="eyebrow" style={{ color: '#00f5ff', textTransform: 'uppercase', fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.15em', display: 'block', marginBottom: '12px' }}>Empowering Professionals</span>
        <h2>About Clyde</h2>
        <p style={{ maxWidth: '680px', margin: '0 auto', fontSize: '1.1rem', color: '#94a3b8', lineHeight: 1.6 }}>
          Standard AI meeting assistants are built for employers to monitor and audit. Clyde is built exclusively for you — the individual professional. It runs silently, locally, and invisibly as your personal career copilot.
        </p>
      </div>

      <div className="about-grid">
        <div className="about-card">
          <h3>The Silent Partner</h3>
          <p>
            Traditional bots join calls with loud names and flashing record lights, creating friction. Clyde runs locally on your desktop, quietly capturing audio and screen feeds without ever invading the social contract of your meeting.
          </p>
        </div>

        <div className="about-card">
          <h3>Absolute Data Sovereignty</h3>
          <p>
            Your transcripts, notes, and career details are yours alone. With optional offline configurations utilizing Faster-Whisper and local LLM integrations, you can operate Clyde 100% privately on your machine. No data leaks, no corporate tracking.
          </p>
        </div>

        <div className="about-card">
          <h3>Context-Aware Intelligence</h3>
          <p>
            Clyde doesn't just transcribe; it comprehends. By analyzing live audio, active screenshots, your master resume, and RAG-based career history, it delivers tailored, STAR-method answer cards and talking points in real-time.
          </p>
        </div>

        <div className="about-card">
          <h3>The Complete Career Loop</h3>
          <p>
            From clipping job descriptions on the web to mock interview practices, real-time meeting support, automatic post-call action items, and data-driven trend analytics, Clyde acts as your personal agent across the full opportunity lifecycle.
          </p>
        </div>

      </div>
    </section>
  );
}

function AboutPage({ navigate }) {
  return (
    <main className="about-page" style={{ paddingBottom: '100px' }}>
      {/* Hero section */}
      <section className="about-band" style={{ paddingTop: '140px', paddingBottom: '60px', textAlign: 'center' }}>
        <div className="section-heading compact">
          <span className="eyebrow" style={{ color: '#00f5ff', textTransform: 'uppercase', fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.15em', display: 'block', marginBottom: '16px' }}>The Human Story</span>
          <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', fontWeight: 900, lineHeight: 1.1, marginBottom: '20px', background: 'linear-gradient(135deg, #ffffff 0%, #94a3b8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Why I Built Clyde
          </h1>
          <p style={{ fontSize: '1.2rem', color: '#94a3b8', lineHeight: 1.6, maxWidth: '640px', margin: '0 auto' }}>
            Clyde wasn't conceived in a corporate board room. It was forged in the trenches of a grueling, modern job search, built to give power back to the individual candidate.
          </p>
        </div>
      </section>

      {/* Main Narrative Card Grid */}
      <section className="section-band" style={{ padding: '0 24px' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '48px' }}>
          
          {/* Story Block 1 */}
          <div className="about-founder-card" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '40px' }}>
            <span className="about-founder-title">Chapter 1: The Struggle</span>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 850, color: '#ffffff', margin: '8px 0 16px' }}>We've All Been in the Black Hole</h2>
            <div style={{ color: '#cbd5e1', fontSize: '1.05rem', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p>
                As a Support Operations leader with over 15 years of experience building and running global teams, I found myself in the same position as millions of others: <strong>subjected to the modern, fragmented job search.</strong>
              </p>
              <p>
                I struggled alongside everyone else. I sent hundreds of custom resumes into the digital void, only to be met with dead silence from automated applicant tracking systems (ATS). I spent hours re-typing my employment history into repetitive form fields that butchered my formatting, and wrestled with buggy web-scrapers that scrambled my achievements. 
              </p>
              <p>
                When I did secure interviews, the overhead was exhausting. Prepping for back-to-back rounds meant juggling dozens of documents, custom ChatGPT prompts, and sticky notes scattered across my desk, trying to remember the exact narrative I wanted to present.
              </p>
            </div>
          </div>

          {/* Story Block 2 */}
          <div className="about-founder-card" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '40px', border: '1px solid rgba(0, 245, 255, 0.15)' }}>
            <span className="about-founder-title">Chapter 2: The Breakthrough</span>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 850, color: '#ffffff', margin: '8px 0 16px' }}>Organizing the Storyteller</h2>
            <div style={{ color: '#cbd5e1', fontSize: '1.05rem', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p>
                During a particularly taxing week of interviews, I had a realization. I didn't just need a form filler — <strong>I needed an intelligent system to organize my entire opportunity pipeline, my target materials, and the professional story I wanted to tell.</strong>
              </p>
              <p>
                I needed a silent, context-aware companion that could read the live room, listen to the interviewer's exact questions, align them with my real-world experience, and instantly present structured <strong>STAR-method (Situation, Task, Action, Result)</strong> talking points to keep my communication crisp and authoritative.
              </p>
              <p>
                I sat down and started coding. That breakthrough led to the birth of <strong>Clyde Desktop</strong> (the undetectable, real-time overlay assistant) paired with <strong>Clyde Go</strong> (the browser extension for 1-click form-fills and job clipping). Together, they became the ultimate, cohesive end-to-end job search and interview agent.
              </p>
            </div>
          </div>

          {/* Story Block 3 */}
          <div className="about-founder-card" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '40px' }}>
            <span className="about-founder-title">Chapter 3: The Triumph & The Mission</span>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 850, color: '#ffffff', margin: '8px 0 16px' }}>From Code to My Dream Job</h2>
            <div style={{ color: '#cbd5e1', fontSize: '1.05rem', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p>
                Using Clyde as my secret partner, my entire application loop shifted from chaotic to precise. I was applying to highly-targeted, better-matched roles in under 20 seconds. More importantly, when I sat down for my interviews, my cognitive load was completely gone. Clyde handled the transcription, matched the context, and fed me the exact data-driven metrics from my past Sigma and Benchmark runs when I needed them.
              </p>
              <p>
                <strong>The method worked. I successfully landed one of my absolute dream jobs.</strong>
              </p>
              <p>
                But my journey didn't end with my own offer letter. Having experienced the anxiety, frustration, and exhaustion of the search firsthand, I made a commitment: <strong>I will not keep this method a secret.</strong> 
              </p>
              <p>
                I released Clyde and Clyde Go to share this exact, verified workflow with everyone currently struggling to land a job. You are a talented professional, builder, or engineer — you shouldn't be locked out by broken resume parsers or interview fatigue. Clyde is here to put the power back in your hands.
              </p>
            </div>
            <div style={{ marginTop: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <a className="primary-link" href={downloadHref}>Get Clyde for Windows</a>
              <button type="button" className="secondary-link" onClick={() => navigate('/pricing')}>See Pricing Tiers</button>
            </div>
          </div>

        </div>
      </section>
    </main>
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
        <img src="/Clyde Screenshots/home_screen.svg" alt="Clyde home screen showing a clean, minimal opportunity workspace" loading="lazy" />
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
          This is a pre-release build for early-access users. Clyde is available on the Microsoft Store at <code>{downloadHref}</code>.
        </p>
        <div className="modal-actions">
          <a className="primary-link" href={downloadHref}>Download from Store</a>
          <button className="secondary-link" type="button" onClick={onClose}>Keep browsing</button>
        </div>
      </div>
    </div>
  );
}

function SupportPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    type: 'Bug Report',
    subject: '',
    description: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setStatus(null);

    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus({ success: true, message: data.message });
        setFormData({
          name: '',
          email: '',
          type: 'Bug Report',
          subject: '',
          description: ''
        });
      } else {
        setStatus({ success: false, message: data.error || 'Failed to submit ticket. Please try again.' });
      }
    } catch (err) {
      console.error(err);
      setStatus({ success: false, message: 'A network error occurred. Please check your connection and try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="support-page">
      <section className="subpage-hero policy-hero" style={{ paddingBottom: '20px' }}>
        <div className="subpage-copy" data-reveal>
          <span className="eyebrow">Help & Feedback</span>
          <h1 style={{ fontSize: '3rem', lineHeight: '1.15', marginBottom: '20px' }}>Clyde Support Center</h1>
          <p style={{ fontSize: '1.15rem', color: '#9ca3af', lineHeight: '1.6' }}>
            Encountered a bug, have a feature request, or need help with your Pro subscription? Submit a ticket below, and we'll get right on it.
          </p>
        </div>
        <aside className="policy-summary-card" data-reveal style={{ background: 'rgba(9, 18, 28, 0.45)', border: '1px solid var(--line)', padding: '24px', borderRadius: '8px' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '12px', fontWeight: 600 }}>Self-service</h2>
          <p style={{ fontSize: '0.9rem', color: '#9ca3af', marginBottom: '12px' }}>You can also access help directly inside the Clyde Desktop app under settings, or ask our floating support agent on the home page.</p>
          <p style={{ fontSize: '0.9rem', color: '#9ca3af', marginBottom: '0px' }}>For billing issues or account inquiries, drop us a line below.</p>
        </aside>
      </section>

      <section className="section-band policy-body" data-reveal style={{ display: 'flex', justifyContent: 'center', paddingTop: '0px', paddingBottom: '80px' }}>
        <div style={{ maxWidth: '650px', width: '100%', background: 'rgba(9, 18, 28, 0.65)', backdropFilter: 'blur(16px)', border: '1px solid var(--line)', borderRadius: '12px', padding: '40px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
          <h2 style={{ marginTop: 0, marginBottom: '24px', fontSize: '1.75rem', fontWeight: 600, background: 'linear-gradient(135deg, var(--cyan), var(--violet))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-block' }}>Submit a ticket</h2>
          
          {status ? (
            <div className={`notification-banner ${status.success ? 'success' : 'error'}`} style={{ padding: '16px', borderRadius: '6px', marginBottom: '24px', fontSize: '0.95rem', lineHeight: '1.5', background: status.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', border: status.success ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)', color: status.success ? '#34d399' : '#f87171' }}>
              {status.message}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="pro-checkout-form" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <div className="support-form-group" style={{ flex: '1 1 200px' }}>
                <label>Your Name</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Stephen" className="support-input" />
              </div>
              <div className="support-form-group" style={{ flex: '1 1 200px' }}>
                <label>Email Address *</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} required placeholder="e.g. stephen@example.com" className="support-input" />
              </div>
            </div>

            <div className="support-form-group">
              <label>Ticket Type *</label>
              <select name="type" value={formData.type} onChange={handleChange} className="support-select">
                <option value="Bug Report">Bug Report</option>
                <option value="Feature Request">Feature Request</option>
                <option value="Feedback">Feedback / Suggestions</option>
                <option value="Billing Issue">Billing Issue</option>
                <option value="General Inquiry">General Inquiry</option>
              </select>
            </div>

            <div className="support-form-group">
              <label>Subject *</label>
              <input type="text" name="subject" value={formData.subject} onChange={handleChange} required placeholder="Brief summary of the issue" className="support-input" />
            </div>

            <div className="support-form-group">
              <label>Description *</label>
              <textarea name="description" value={formData.description} onChange={handleChange} required placeholder="Please describe your bug or feature request in detail..." className="support-textarea" />
            </div>

            <button type="submit" disabled={submitting} className="primary-link" style={{ padding: '14px', borderRadius: '6px', border: 'none', background: submitting ? 'rgba(56, 189, 248, 0.4)' : 'var(--cyan)', color: '#030609', fontSize: '0.95rem', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', transition: 'opacity 0.2s', marginTop: '10px' }}>
              {submitting ? (
                <>
                  <span className="spinner-icon" style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Submitting Ticket...
                </>
              ) : 'Submit Ticket ✨'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function Footer({ navigate, onDownload }) {
  return (
    <footer className="site-footer">
      <div>
        <a className="brand-link" href="/" onClick={(event) => { event.preventDefault(); navigate('/'); }}>
          <img src="/clydefree.svg" alt="" />
          <span>Clyde</span>
        </a>
        <p>Private AI help for interviews and meetings.</p>
      </div>
      <div className="footer-links">
        <a href="/clyde-go" onClick={(event) => { event.preventDefault(); navigate('/clyde-go'); }}>Clyde Go<span className="nav-badge">Soon</span></a>
        <a href="/how-it-works" onClick={(event) => { event.preventDefault(); navigate('/how-it-works'); }}>How it works</a>
        <a href="/about" onClick={(event) => { event.preventDefault(); navigate('/about'); }}>About</a>
        <a href="/support" onClick={(event) => { event.preventDefault(); navigate('/support'); }}>Support</a>
        <a href="/kb" onClick={(event) => { event.preventDefault(); navigate('/kb'); }}>Knowledge Base</a>
        <a href="/privacy-policy" onClick={(event) => { event.preventDefault(); navigate('/privacy-policy'); }}>Privacy</a>
        <a href="/terms-of-service" onClick={(event) => { event.preventDefault(); navigate('/terms-of-service'); }}>Terms</a>
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

function FloatingSupportChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'bot', text: "Hi! I'm Clyde's official AI assistant. Ask me anything about downloading, features, pricing, or local setup!" }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadQuery, setLeadQuery] = useState('');
  const [leadSuccess, setLeadSuccess] = useState(false);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const query = inputText.trim();
    if (!query || isLoading) return;

    setInputText('');
    setMessages(prev => [...prev, { role: 'user', text: query }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query, type: 'message' })
      });
      const data = await res.json();
      
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'bot', text: data.reply }]);
        
        // Check if bot offered to connect to human/Stephen
        if (data.reply.toLowerCase().includes('connect you with stephen') || data.reply.toLowerCase().includes('log a ticket')) {
          setLeadQuery(query);
          setTimeout(() => {
            setShowLeadForm(true);
          }, 1500);
        }
      } else {
        setMessages(prev => [...prev, { role: 'bot', text: "I'm having trouble connecting to support. Would you like to leave a message? Click 'Contact Support' below." }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', text: "Connection error. Would you like to leave a message? Click 'Contact Support' below." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeadSubmit = async (e) => {
    e.preventDefault();
    if (!leadEmail.trim() || !leadQuery.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'lead',
          name: leadName,
          email: leadEmail,
          query: leadQuery
        })
      });
      const data = await res.json();
      if (data.success) {
        setLeadSuccess(true);
        setTimeout(() => {
          setShowLeadForm(false);
          setLeadSuccess(false);
          setLeadName('');
          setLeadEmail('');
          setLeadQuery('');
          setMessages(prev => [...prev, { role: 'bot', text: "Successfully saved your request! Stephen will reach out to you shortly via email." }]);
        }, 3000);
      }
    } catch (err) {
      alert("Failed to submit support request. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 99999, fontFamily: 'Courier, monospace' }}>
      {/* Floating Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(79, 231, 255, 0.3)',
          boxShadow: '0 8px 24px rgba(0, 245, 255, 0.35)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        title="Chat with Clyde Support"
      >
        <img src="/clyde-free-coin.svg" alt="Clyde Support" style={{ width: '38px', height: '38px' }} />
      </button>

      {/* Expandable Chat Window */}
      {isOpen && (
        <div 
          style={{
            width: '360px',
            height: '520px',
            position: 'absolute',
            bottom: '72px',
            right: '0',
            background: 'rgba(10, 12, 16, 0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.6)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'slideInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) both'
          }}
        >
          {/* Header */}
          <div style={{ padding: '16px 20px', background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>👻</span>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#00f5ff', fontWeight: 'bold' }}>Clyde Support Bot</h4>
                <span style={{ fontSize: '0.68rem', color: '#888888' }}>24/7 AI Assistant</span>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              style={{ background: 'transparent', border: 'none', color: '#888888', cursor: 'pointer', fontSize: '16px' }}
            >
              ✕
            </button>
          </div>

          {/* Content Area */}
          {!showLeadForm ? (
            <>
              {/* Message History */}
              <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {messages.map((m, idx) => (
                  <div key={idx} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                    <div 
                      style={{
                        padding: '10px 14px',
                        borderRadius: '16px',
                        fontSize: '0.8rem',
                        lineHeight: '1.4',
                        background: m.role === 'user' ? 'rgba(0, 122, 255, 0.45)' : 'rgba(38, 38, 43, 0.6)',
                        color: m.role === 'user' ? '#ffffff' : '#e5e5ea',
                        border: '1px solid rgba(255, 255, 255, 0.04)',
                        wordBreak: 'break-word'
                      }}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div style={{ alignSelf: 'flex-start', background: 'rgba(38, 38, 43, 0.6)', padding: '10px 14px', borderRadius: '16px', fontSize: '0.8rem' }}>
                    <span className="btn-spinner" style={{ width: '12px', height: '12px', marginRight: '6px' }}></span> Thinking...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Form */}
              <form onSubmit={handleSendMessage} style={{ padding: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Ask a question..."
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '99px',
                    padding: '8px 16px',
                    fontSize: '0.8rem',
                    color: '#ffffff',
                    outline: 'none'
                  }}
                />
                <button 
                  type="submit" 
                  disabled={isLoading || !inputText.trim()}
                  style={{
                    background: '#007aff',
                    border: 'none',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    cursor: 'pointer'
                  }}
                >
                  ➔
                </button>
              </form>

              {/* Direct Handoff Button */}
              <button 
                onClick={() => setShowLeadForm(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#888888',
                  fontSize: '0.72rem',
                  padding: '8px 0',
                  cursor: 'pointer',
                  textAlign: 'center',
                  textDecoration: 'underline'
                }}
              >
                Need to contact Stephen directly? Click here
              </button>
            </>
          ) : (
            /* Lead Generation Form */
            <form onSubmit={handleLeadSubmit} style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', justifyContent: 'center' }}>
              {leadSuccess ? (
                <div style={{ textAlign: 'center', color: '#00f5ff', fontSize: '0.85rem' }}>
                  <h3>✅ Message Logged</h3>
                  <p>Thanks! Stephen will get back to you soon.</p>
                </div>
              ) : (
                <>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#00f5ff', fontWeight: 'bold' }}>Contact Clyde Support</h3>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#888888', lineHeight: '1.4' }}>
                    Leave your details, and your request will be securely synced to Stephen's support queue.
                  </p>
                  
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', color: '#ffffff' }}>
                    Your Name
                    <input 
                      type="text" 
                      required
                      value={leadName}
                      onChange={(e) => setLeadName(e.currentTarget.value)}
                      placeholder="Jane Doe"
                      style={{ padding: '8px 12px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', color: '#ffffff', outline: 'none' }}
                    />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', color: '#ffffff' }}>
                    Email Address
                    <input 
                      type="email" 
                      required
                      value={leadEmail}
                      onChange={(e) => setLeadEmail(e.currentTarget.value)}
                      placeholder="jane@example.com"
                      style={{ padding: '8px 12px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', color: '#ffffff', outline: 'none' }}
                    />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', color: '#ffffff' }}>
                    Your Question
                    <textarea 
                      required
                      value={leadQuery}
                      onChange={(e) => setLeadQuery(e.currentTarget.value)}
                      placeholder="How do I..."
                      style={{ padding: '8px 12px', minHeight: '80px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', color: '#ffffff', outline: 'none', resize: 'none' }}
                    />
                  </label>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <button 
                      type="button" 
                      onClick={() => setShowLeadForm(false)}
                      style={{ flex: 1, padding: '10px 0', background: 'rgba(255, 255, 255, 0.08)', border: 'none', borderRadius: '8px', color: '#ffffff', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      Back
                    </button>
                    <button 
                      type="submit" 
                      disabled={isLoading}
                      style={{ flex: 1, padding: '10px 0', background: 'linear-gradient(135deg, #00f5ff, #007aff)', border: 'none', borderRadius: '8px', color: '#ffffff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                    >
                      {isLoading ? 'Sending...' : 'Submit'}
                    </button>
                  </div>
                </>
              )}
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function DeleteAccountPage({ navigate }) {
  const params = new URLSearchParams(window.location.search);
  const [email, setEmail] = useState(params.get('email') || '');
  const [userId, setUserId] = useState(params.get('userId') || '');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleDeleteSubmit(event) {
    event.preventDefault();
    const targetEmail = email.trim();
    if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    setStatus('');
    setError('');
    try {
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, userId: userId.trim() })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Account deletion request failed.');
      }
      setStatus('Your account deletion request has been processed successfully! All associated personal data and files will be permanently purged from Clyde within 24 hours. You will receive an automated confirmation email once complete.');
      setEmail('');
      setUserId('');
    } catch (err) {
      setError(err.message || 'Account deletion failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-confirmed-page">
      <section className="subpage-hero policy-hero">
        <div className="subpage-copy is-visible">
          <span className="eyebrow" style={{ color: '#ef4444' }}>Privacy & Security</span>
          <h1>Request Account & Data Deletion</h1>
          <p>Please confirm your account email address and User ID below. On confirmation, we will permanently scrub your experience logs, credentials, custom Q&As, and stored resumes from Clyde within 24 hours.</p>
          
          <form className="auth-password-form" onSubmit={handleDeleteSubmit} style={{ marginTop: '24px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '16px' }}>
              Email Address
              <input
                type="email"
                required
                autoComplete="email"
                disabled={busy}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@email.com"
                style={{
                  background: '#0f172a',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '12px',
                  color: '#f8fafc',
                  fontSize: '0.95rem',
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', color: '#cbd5e1' }}>
              User ID (Optional)
              <input
                type="text"
                disabled={busy}
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                style={{
                  background: '#0f172a',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '12px',
                  color: '#f8fafc',
                  fontSize: '0.95rem',
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
            </label>
            <button
              className="primary-link"
              type="submit"
              disabled={busy}
              style={{
                background: 'linear-gradient(to right, #ef4444, #b91c1c)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '14px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: busy ? 'wait' : 'pointer',
                marginTop: '24px',
                width: '100%',
                boxSizing: 'border-box',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {busy ? <span className="btn-spinner" aria-hidden="true" /> : null}
              {busy ? 'Processing request...' : 'Delete My Account & Data'}
            </button>
            {error ? <p className="auth-status" style={{ color: '#ef4444', marginTop: '12px' }}>{error}</p> : null}
            {status ? <p className="auth-status" style={{ color: '#10b981', marginTop: '12px', lineHeight: '1.5' }}>{status}</p> : null}
          </form>
        </div>
        <aside className="policy-summary-card is-visible">
          <h2>Data Deletion Policy</h2>
          <p>
            Clyde completely respects your privacy and right to be forgotten under GDPR and CCPA regulations.
          </p>
          <p style={{ marginTop: '12px' }}>
            All documents, customized resume revisions, AI billing ledger lines, and active extensions tokens are permanently wiped out and are completely irrecoverable once this deletion resolves.
          </p>
          <p style={{ marginTop: '12px', fontSize: '0.85rem', color: '#94a3b8' }}>
            Need direct help or have questions? Contact support on our <a href="/support" onClick={(e) => { e.preventDefault(); navigate('/support'); }} style={{ color: '#6366f1', textDecoration: 'underline' }}>Support Page</a>.
          </p>
        </aside>
      </section>
    </main>
  );
}

function PracticePage({ onDownload, navigate }) {
  return (
    <main>
      <section className="subpage-hero">
        <div className="subpage-copy" data-reveal>
          <span className="eyebrow">Interactive Interview Simulation</span>
          <h1>Master Your Next Round with Realistic AI Mock Practice.</h1>
          <p>
            Build your confidence and refine your answers with Clyde's realistic mock interview simulator. 
            Practice speaking against role-specific questions, receive instant behavioral feedback, and analyze your performance with detailed scorecards.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href={downloadHref} onClick={onDownload}>Download Clyde</a>
            <a className="secondary-link" href="#live-demo">Try Live Practice Demo</a>
          </div>
        </div>
        <figure className="large-product-figure" data-reveal>
          <img src="/Clyde Screenshots/mock interview scorecard.svg" alt="Clyde Mock Interview Scorecard" />
        </figure>
      </section>

      <section className="section-band mock-band" id="live-demo" data-reveal style={{ padding: '80px 0' }}>
        <div className="mock-copy">
          <span className="eyebrow">Realtime mock interviews</span>
          <h2>Practice against realistic role-specific scenarios.</h2>
          <p>
            Test your skills right now with our interactive video practice avatar. Click start, grant microphone access, and experience a realistic, supportive interview environment in real-time.
          </p>
          <div className="mock-points">
            <span>Adaptive questions</span>
            <span>Microphone-driven answers</span>
            <span>Instant sandbox practice</span>
          </div>
        </div>
        <div className="liveavatar-demo">
          <LiveAvatarPracticeDemo />
        </div>
      </section>

      <section className="section-band image-showcase-band" data-reveal>
        <div className="section-heading compact">
          <h2>Detailed 0-100 Performance Scorecards</h2>
          <p>
            At the end of every mock session, Clyde turns your transcript into direct behavioral insights, assessing delivery pacing, content relevance, and structural strengths to give you a clear roadmap for improvement.
          </p>
        </div>
        <figure className="large-product-figure">
          <img src="/Clyde Screenshots/mock interview scorecard.svg" alt="Clyde mock interview scorecard with detailed assessment categories and feedback" loading="lazy" />
        </figure>
      </section>

      <TrendShowcase />

      <section className="section-band privacy-band" data-reveal style={{ marginBottom: '60px' }}>
        <div className="privacy-copy">
          <span className="eyebrow">Local-first privacy</span>
          <h2>100% Private, Secure Preparation.</h2>
          <p>
            Clyde respects your confidentiality. You can choose to run all transcriptions, speech-to-text, and evaluation models completely locally on your own machine. Your preparation data stays private to you.
          </p>
          <button type="button" className="secondary-link" onClick={() => navigate('/how-it-works')}>See how privacy works</button>
        </div>
        <PrivacyVisual />
      </section>
    </main>
  );
}

function normalizePath(value) {
  if (!value || value === '/index.html') return '/';
  return value.endsWith('/') && value.length > 1 ? value.slice(0, -1) : value;
}

// ==================================================
// CUSTOMER FACING KNOWLEDGE BASE PAGE
// ==================================================
function KnowledgeBasePage({ navigate }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedArticle, setSelectedArticle] = useState(null);

  const categories = [
    { id: 'all', label: 'All Articles' },
    { id: 'desktop', label: 'Clyde Desktop' },
    { id: 'go', label: 'Clyde Go (Extension)' },
    { id: 'pro', label: 'Pro & Licensing' },
    { id: 'audio', label: 'Audio & Transcription' }
  ];

  const articles = [
    {
      id: 'desktop-loopback-conflict',
      category: 'desktop',
      categoryLabel: 'Clyde Desktop App',
      title: 'Resolving Realtek HSA & Nahimic Loopback Audio Conflicts',
      summary: 'Standard troubleshooting steps for loopback capture engine crash alerts like ERR_LOOPBACK_CONFLICT_REALTEK.',
      content: `
        <h3>The Problem</h3>
        <p>While using Clyde Desktop loopback capture on certain Windows machines (especially gaming laptops like HP OMEN, Dell Alienware, or Asus ROG), you might encounter audio engine crash logs or an explicit error console code: <code>ERR_LOOPBACK_CONFLICT_REALTEK</code>.</p>
        
        <h3>The Underlying Cause</h3>
        <p>Proprietary audio optimization suites—specifically <strong>Nahimic Audio</strong>, <strong>Realtek HSA Service</strong>, or gaming center audio drivers—inject active handles into the windows default output device. They capture exclusive loopback hooks, which prevents Clyde's local recorder from binding to the stream.</p>
        
        <h3>How to Fix It Manually</h3>
        <ul>
          <li><strong>Step 1: Disable Exclusive Mode</strong>
            <p>Open the Windows Sound Control Panel (type <code>mmsys.cpl</code> in Run), select your default playback device, click <strong>Properties</strong>, navigate to the <strong>Advanced</strong> tab, and uncheck "Allow applications to take exclusive control of this device". Click Apply.</p>
          </li>
          <li><strong>Step 2: Append CLI Bypasses</strong>
            <p>Launch Clyde Desktop with the direct launch flag: <code>--disable-exclusive-audio-hooks</code>. This instructs Clyde's recording driver to hook into shared loopback streams instead of exclusive system audio registers.</p>
          </li>
          <li><strong>Step 3: Administrative Escalation</strong>
            <p>Right-click the Clyde.exe shortcut and choose <strong>"Run as administrator"</strong>. This overrides driver registry exclusion hierarchies and forces audio handle alignment.</p>
          </li>
        </ul>
      `
    },
    {
      id: 'go-react-hydration',
      category: 'go',
      categoryLabel: 'Clyde Go (Extension)',
      title: 'Addressing Workday Form Input React State Hydration Latency',
      summary: 'Why form fields visually fill out but empty upon submission on Workday portals, and how to fix it.',
      content: `
        <h3>The Problem</h3>
        <p>When using the Clyde Go Chrome extension (MV3) to auto-fill applicant portals (specifically Workday, Taleo, or Greenhouse), the input elements visually fill out. However, when you click Submit, fields like graduation date, graduation year, or GPA vanish or throw required validation errors.</p>
        
        <h3>The Underlying Cause</h3>
        <p>Workday and enterprise HR gateways run heavily throttled React synthetic state frameworks. When an extension injects text directly into the raw DOM node's <code>value</code> attribute too rapidly, React's virtual DOM state handlers do not hydrate. The field updates visually, but the database state remains blank.</p>
        
        <h3>How to Fix It Manually</h3>
        <ul>
          <li><strong>Step 1: Check Extension Version</strong>
            <p>Verify you are running Clyde Go <strong>v2.4.1 or higher</strong>. We implemented a native <strong>150ms post-hydration delay</strong> inside our MV3 injection pipeline specifically to accommodate Workday throttle rates.</p>
          </li>
          <li><strong>Step 2: Force Change Handlers</strong>
            <p>If you are encountering a custom form, select the field and press any key (like Space then Backspace). This manual keystroke triggers the DOM's native <code>change</code> event and binds the visual data directly to React's synthetic states.</p>
          </li>
          <li><strong>Step 3: Clear Overlapping Auto-Fills</strong>
            <p>Ensure that Chrome's default browser auto-fill is turned off. Overlapping auto-fills can cause race conditions inside React's state tree.</p>
          </li>
        </ul>
      `
    },
    {
      id: 'pro-byok-licensing',
      category: 'pro',
      categoryLabel: 'Pro & Licensing',
      title: 'Bring Your Own Key (BYOK) Configuration & Signature Validation',
      summary: 'How to wire up your own API keys (Anthropic, OpenAI, Pinecone) for infinite offline-ready AI drafts.',
      content: `
        <h3>The Advantage of BYOK</h3>
        <p>Clyde Pro includes high-speed managed cloud credits, but also provides a complete **Bring Your Own Key (BYOK)** system. This allows you to configure your local client with personal OpenAI, Anthropic, or Pinecone credentials for unlimited, unconstrained AI draft generation.</p>
        
        <h3>How to Configure Custom Keys</h3>
        <p>To enter your credentials securely:</p>
        <ol>
          <li>Open Clyde Desktop and navigate to <strong>Settings</strong> -> <strong>AI API Configuration</strong>.</li>
          <li>Toggle on the **"Enable Personal API keys"** option.</li>
          <li>Input your custom keys:
            <ul>
              <li><code>GEMINI_API_KEY</code> - For high-speed models.</li>
              <li><code>OPENAI_API_KEY</code> / <code>ANTHROPIC_API_KEY</code> - For complex reasoning drafts.</li>
              <li><code>PINECONE_API_KEY</code> - For indexing custom sitemaps/KBs locally.</li>
            </ul>
          </li>
          <li>Click Save. Your keys are fully encrypted using Windows Credential Locker APIs on disk.</li>
        </ol>
        
        <h3>Offline Licensing Architecture</h3>
        <p>Your Clyde Pro lifetime or monthly validation runs locally on-machine. Upon purchase, Clyde generates a locally-validated license block signed using secure **RSA-2048 cryptographically signed signatures** (via <code>validateLicenseKey</code>). This ensures Clyde remains functional and authentic even during offline network gaps.</p>
      `
    },
    {
      id: 'desktop-stealth-mode',
      category: 'desktop',
      categoryLabel: 'Clyde Desktop App',
      title: 'Enabling Stealth Mode (Programmatic Taskbar & Alt+Tab Bypass)',
      summary: 'How to completely hide Clyde from active screens, Windows taskbars, and Alt+Tab switchers.',
      content: `
        <h3>The Stealth Feature</h3>
        <p>Stephen designed Clyde to maintain absolute "stealth and undetectable" characteristics during high-stakes customer sessions. Clyde Desktop includes options to completely bypass the standard Windows taskbar and Alt+Tab panels.</p>
        
        <h3>How to Activate Stealth Mode</h3>
        <ol>
          <li>Go to the **Settings** panel inside Clyde Desktop.</li>
          <li>Scroll down to **Stealth & OS Integration**.</li>
          <li>Turn on **"Stealth Taskbar Mode"**.</li>
          <li>Once enabled, Clyde will call native win32 APIs to re-register its active window handle as a tool window:
            <pre><code>SetWindowLong(hwnd, GWL_EXSTYLE, WS_EX_TOOLWINDOW)</code></pre>
            This strips Clyde from the Windows Taskbar and Alt+Tab switcher instantly.
          </li>
        </ol>
        
        <h3>How to Recall the Window</h3>
        <p>When running in Stealth mode, Clyde remains active and triaging in the background. To recall the visual window, press your global configured shortcut (default is <code>Ctrl + Alt + C</code>) or click the Clyde system tray icon.</p>
      `
    },
    {
      id: 'audio-one-question-lag',
      category: 'audio',
      categoryLabel: 'Audio & Transcription',
      title: 'Eliminating One-Question-Behind Lag on Local Call Transcripts',
      summary: 'Adjusting voice activity detection and sentence completion thresholds to prevent display latency.',
      content: `
        <h3>The Issue</h3>
        <p>During active calls under local offline transcription modes, you might experience a "one-question-behind" latency. The answer card representing the current question does not appear until the interviewer begins speaking the *subsequent* question.</p>
        
        <h3>The Root Cause</h3>
        <p>Local Speech-to-Text models lack complex contextual punctuation filters. Unpunctuated phrase fragments (like *"this particular"* or *"maintain high"*) are parsed as complete sentences. The local engine triggers the answer compiler early, and the subsequent 12-second rate-limiting gate blocks the actual completed question when it concludes.</p>
        
        <h3>The Fix</h3>
        <ul>
          <li><strong>Step 1: Enforce Strict Punctuation Gates</strong>
            <p>In Sound Settings, toggle **"Enforce Strict Punctuation Gates"** to active. This restricts the local transcription pathway from firing compilations unless an explicit terminal punctuation mark (<code>?</code>, <code>.</code>, or <code>!</code>) is returned or matched via the ASR regex tree.</p>
          </li>
          <li><strong>Step 2: Adjust Voice Activity Detection (VAD)</strong>
            <p>Decrease your VAD silence threshold to <strong>450ms</strong> inside settings. This prevents natural mid-sentence pauses from being categorized as completed queries.</p>
          </li>
          <li><strong>Step 3: Update local COMPLETE prompts</strong>
            <p>Ensure your local Whisper parser maps loose streams to cloud endpoints for intent validation only, protecting the local loop.</p>
          </li>
        </ul>
      `
    },
    {
      "id": "clyde-go-mv3-auth",
      "keyword": "Clyde Go MV3 Extension Auth & Chrome Sandbox",
      "draftTitle": "Resolving Chrome MV3 Extension Authentication & Sandbox Failures",
      "draftContent": "The Clyde Go Chrome extension operates under Google's strict Manifest V3 (MV3) guidelines. If you face authentication drops or session timeouts inside Chrome, it's usually caused by Chrome's service worker going idle.\n\nTo resolve:\n1. Update Clyde Go to v2.4.2 to ensure keep-alive nonces are sent.\n2. Ensure the background service worker registry is white-listed under Chrome's Content Security Policies (CSP)."
    }
  ];

  const filteredArticles = articles.filter(art => {
    const matchesSearch = art.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          art.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (art.content && art.content.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = activeCategory === 'all' || art.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div class="min-h-screen bg-cyber-bg text-slate-200 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div class="max-w-6xl mx-auto">
        
        {/* KB Breadcrumb & Header */}
        <div class="mb-10" data-reveal>
          <div class="flex items-center gap-2 text-xs text-slate-400 font-mono mb-4">
            <button onClick={() => navigate('/')} class="hover:text-cyber-cyan transition-colors">Home</button>
            <span>/</span>
            <span class="text-cyber-violet">Knowledge Base</span>
          </div>
          <h1 class="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-cyber-cyan to-cyber-violet bg-clip-text text-transparent inline-block">
            Clyde Knowledge Center
          </h1>
          <p class="text-slate-400 text-sm mt-2 max-w-xl">
            Detailed configurations, technical guides, troubleshooting runbooks, and manual workarounds built for Clyde Desktop and Clyde Go.
          </p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Sidebar Filter & Search */}
          <div class="lg:col-span-4 space-y-6">
            
            {/* Search Box */}
            <div class="relative rounded-xl border border-cyber-line/30 bg-cyber-bgSoft/40 backdrop-blur-md p-4 shadow-xl">
              <label class="text-xs font-bold text-slate-300 block mb-2 font-mono">Search Runbooks</label>
              <div class="relative">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g., Realtek, Workday, BYOK..." 
                  class="w-full bg-cyber-bg/80 border border-cyber-line/30 rounded-lg p-2.5 pl-9 text-sm text-slate-200 focus:outline-none focus:border-cyber-cyan/50 font-sans transition-all"
                />
                <div class="absolute left-3 top-3 text-slate-400">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                </div>
              </div>
            </div>

            {/* Categories */}
            <div class="rounded-xl border border-cyber-line/30 bg-cyber-bgSoft/40 backdrop-blur-md p-4 shadow-xl space-y-2">
              <span class="text-xs font-bold text-slate-300 block mb-3 font-mono">Filter by Category</span>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => { setActiveCategory(cat.id); setSelectedArticle(null); }}
                  class={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold font-mono transition-all flex items-center justify-between ${
                    activeCategory === cat.id 
                      ? 'bg-cyber-cyan/15 border border-cyber-cyan/30 text-cyber-cyan shadow-sm shadow-cyber-cyan/10' 
                      : 'border border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span class="text-[9px] opacity-60">
                    {cat.id === 'all' 
                      ? articles.length 
                      : articles.filter(a => a.category === cat.id).length
                    }
                  </span>
                </button>
              ))}
            </div>

            {/* Direct Ticket Help Card */}
            <div class="rounded-xl border border-cyber-line/30 bg-gradient-to-br from-cyber-violetMuted/10 to-cyber-cyanMuted/5 p-5 relative overflow-hidden shadow-xl">
              <h3 class="text-xs font-bold font-mono text-cyber-cyan mb-2">Still need support?</h3>
              <p class="text-[11px] text-slate-400 leading-relaxed mb-4">
                Can't find a solution to your device or extension conflict? Submit a technical ticket directly to our engineers.
              </p>
              <button 
                onClick={() => navigate('/support')}
                class="w-full text-center py-2.5 rounded-lg text-xs font-bold text-cyber-bg bg-gradient-to-r from-cyber-cyan to-cyber-violet hover:opacity-90 transition-all font-mono"
              >
                Open Support Ticket
              </button>
            </div>

          </div>

          {/* Right Main Article Section */}
          <div class="lg:col-span-8">
            
            {/* If an article is open */}
            {selectedArticle ? (
              <div class="rounded-2xl border border-cyber-line/30 bg-cyber-bgSoft/50 backdrop-blur-md p-8 shadow-2xl space-y-6" data-reveal>
                <div class="flex items-center justify-between pb-4 border-b border-cyber-line/20">
                  <span class="px-2.5 py-1 rounded-full text-[9px] font-bold font-mono text-cyber-cyan bg-cyber-cyan/15 border border-cyber-cyan/30">
                    {selectedArticle.categoryLabel || 'Support'}
                  </span>
                  <button 
                    onClick={() => setSelectedArticle(null)}
                    class="text-xs font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"></path>
                    </svg>
                    <span>Back to Article List</span>
                  </button>
                </div>

                <div class="space-y-4">
                  <h2 class="text-2xl font-extrabold text-white leading-tight font-sans">
                    {selectedArticle.title}
                  </h2>
                  <div 
                    className="kb-article-body text-slate-300 text-sm leading-relaxed space-y-4 font-sans"
                    dangerouslySetInnerHTML={{ __html: selectedArticle.content || selectedArticle.draftContent }}
                  />
                </div>
              </div>
            ) : (
              /* Article Grid/List */
              <div class="space-y-4">
                <span class="text-xs font-bold text-slate-400 font-mono block mb-2">
                  Showing {filteredArticles.length} matching runbooks
                </span>
                
                {filteredArticles.length === 0 ? (
                  <div class="rounded-xl border border-cyber-line/20 bg-cyber-bgSoft/30 p-12 text-center text-slate-400 space-y-4">
                    <p class="text-sm font-semibold">No Knowledge Base articles found matching "{searchQuery}"</p>
                    <button 
                      onClick={() => { setSearchQuery(''); setActiveCategory('all'); }}
                      class="text-xs text-cyber-cyan hover:underline font-mono"
                    >
                      Clear filters and try again
                    </button>
                  </div>
                ) : (
                  filteredArticles.map(art => (
                    <div 
                      key={art.id}
                      onClick={() => setSelectedArticle(art)}
                      class="rounded-xl border border-cyber-line/30 bg-cyber-bgSoft/40 hover:bg-cyber-bgSoft/65 hover:border-cyber-violet/30 cursor-pointer p-5 transition-all space-y-3 group shadow-lg"
                    >
                      <div class="flex items-center justify-between">
                        <span class="text-[9px] font-bold font-mono text-cyber-cyan bg-cyber-cyan/10 px-2 py-0.5 rounded border border-cyber-cyan/20">
                          {art.categoryLabel || 'Support'}
                        </span>
                        <span class="text-[9px] font-mono text-slate-500 group-hover:text-cyber-violet transition-colors">
                          Read runbook →
                        </span>
                      </div>
                      <div>
                        <h3 class="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">
                          {art.title || art.draftTitle}
                        </h3>
                        <p class="text-[11px] text-slate-400 mt-1 leading-normal font-sans">
                          {art.summary || art.draftContent.substring(0, 120) + "..."}
                        </p>
                      </div>
                    </div>
                  ))
                )}

              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}

export { normalizePath };
export default App;
