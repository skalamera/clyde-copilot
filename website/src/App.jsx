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
    { id: 'desktop', label: 'Clyde Desktop App' },
    { id: 'go', label: 'Clyde Go (Extension)' },
    { id: 'pro', label: 'Pro & Licensing' },
    { id: 'audio', label: 'Audio & Transcription' }
  ];

  const articles = [
    {
      id: 'clyde-desktop-setup',
      category: 'desktop',
      categoryLabel: 'Clyde Desktop App',
      title: 'Getting Started with Clyde Desktop',
      summary: 'A quick-and-dirty, step-by-step guide to installing Clyde Desktop, picking your workspace mode, and starting your first captured session.',
      content: `<h3 style="color: #00ffcc; border-bottom: 1px solid #00ffcc; padding-bottom: 4px;">Getting Up and Running</h3>
<p>Hey there! Ready to get Clyde set up? We designed Clyde to be zero-friction, running fully on your machine with no annoying cloud-recording bots joining your calls. No one will ever know you're using it unless you tell them.</p>
<p>First, grab the installer for your OS, run it, and launch the Clyde app. Once you're inside, follow the five-minute onboarding tour or close it to dive straight into the main dashboard.</p>

<h3 style="color: #00ffcc; border-bottom: 1px solid #00ffcc; padding-bottom: 4px;">The Big Choice: Interview Mode vs. Meeting Mode</h3>
<p>Before you hit record, you need to decide what kind of session you're running. This defines how Clyde behaves, what kind of suggestions it gives you, and where your data gets saved:</p>
<ul style="list-style-type: square; padding-left: 20px; color: #e0e0e0;">
  <li style="margin-bottom: 8px;"><strong style="color: #ff3366;">Interview Mode:</strong> Perfect for technical rounds, recruiter screens, and hiring manager loops. In this mode, Clyde pulls up your job descriptions, links opportunity context, tracks your questions, and calibrates your post-session confidence scorecards.</li>
  <li style="margin-bottom: 8px;"><strong style="color: #ff3366;">Meeting Mode:</strong> Built for weekly standups, product retros, investor updates, or 1:1s. This mode ditches interview grading and focuses on keeping razor-sharp transcripts, tracking action items, identifying blockers, and listing key decisions by attendee.</li>
</ul>

<h3 style="color: #00ffcc; border-bottom: 1px solid #00ffcc; padding-bottom: 4px;">Step-by-Step Workspace Setup</h3>
<p>Here is your quick pre-flight checklist to make sure your first call is a massive win:</p>
<ul style="list-style-type: decimal; padding-left: 20px; color: #e0e0e0;">
  <li style="margin-bottom: 8px;"><strong style="color: #ffff00;">Select Your Active Context:</strong> Look at the top title bar and pick the specific interview opportunity or meeting context. Clyde uses this to file your transcripts, notes, and suggested next steps correctly.</li>
  <li style="margin-bottom: 8px;"><strong style="color: #ffff00;">Configure AI Models:</strong> Hit the gear icon to open <span style="background-color: #222; color: #00ffcc; padding: 2px 6px; font-family: monospace;">Settings</span>. Pick your transcription provider and your LLM companion (we support cloud models and offline local setups).</li>
  <li style="margin-bottom: 8px;"><strong style="color: #ffff00;">Run Preflight Checks:</strong> When you hit the bright <strong style="color: #00ffcc;">Start</strong> button, a preflight window pops up. Use this to double-check your audio inputs, confirm screen capture protection is on, and verify Clyde is reading the right files.</li>
</ul>

<div style="background-color: #1a0033; border: 2px solid #9933ff; color: #ffffff; padding: 15px; border-radius: 6px; margin: 15px 0;">
  <strong style="color: #00ffcc; font-size: 1.1rem;">💻 Pro-Tip: Opacity controls</strong><br/>
  You can slide Clyde's window transparency from 100% all the way down to 35% in the bottom control bar. This lets you lay Clyde directly over your meeting slides or IDE, keeping helpful cues visible while keeping your desktop completely clean.
</div>`
    },
    {
      id: 'audio-permissions',
      category: 'desktop',
      categoryLabel: 'Clyde Desktop App',
      title: 'Resolving Microphone & System Audio Access',
      summary: 'Is Clyde silent? Here is how to navigate macOS and Windows permissions, make sure your mic is unblocked, and ensure system audio flows cleanly.',
      content: `<h3 style="color: #ff3366; border-bottom: 1px solid #ff3366; padding-bottom: 4px;">Why Clyde Needs Your Mic</h3>
<p>Because Clyde runs completely locally on your desktop (no cloud bots, no calendar invitations needed), it acts like a high-performance recording deck. That means it needs explicit permission from your operating system to grab your microphone and capture the audio outputting from Zoom, Teams, or Google Meet.</p>

<h3 style="color: #ff3366; border-bottom: 1px solid #ff3366; padding-bottom: 4px;">Unblocking Permissions on Windows 10 & 11</h3>
<p>Usually, Windows plays nice out of the box, but OS security updates can sometimes shut down mic access. Follow these steps to make sure Clyde is in the clear:</p>
<ul style="list-style-type: square; padding-left: 20px; color: #e0e0e0;">
  <li style="margin-bottom: 8px;">Open your system menu and head to <span style="background-color: #222; color: #00ffcc; padding: 2px 4px; font-family: monospace;">Settings → Privacy & Security → Microphone</span>.</li>
  <li style="margin-bottom: 8px;">Ensure <strong style="color: #ffff00;">Microphone access</strong> is toggled to <strong style="color: #00ffcc;">ON</strong>.</li>
  <li style="margin-bottom: 8px;">Scroll down to "Let desktop apps access your microphone" and make sure Clyde is allowed. If Clyde isn't listed, simply close the app, launch it as Administrator once, and trigger a capture session to force the Windows prompt.</li>
</ul>

<h3 style="color: #ff3366; border-bottom: 1px solid #ff3366; padding-bottom: 4px;">Fixing the macOS Security Gauntlet</h3>
<p>Apple's macOS is incredibly strict about audio and screen recording. If Clyde isn't generating transcripts, it's almost always an OS permission block:</p>
<ul style="list-style-type: circle; padding-left: 20px; color: #e0e0e0;">
  <li style="margin-bottom: 8px;"><strong style="color: #ff3366;">Microphone Access:</strong> Go to <span style="background-color: #222; color: #00ffcc; padding: 2px 4px; font-family: monospace;">System Settings → Privacy & Security → Microphone</span> and toggle Clyde <strong style="color: #00ffcc;">ON</strong>.</li>
  <li style="margin-bottom: 8px;"><strong style="color: #ff3366;">Screen & System Audio Recording:</strong> Since system audio capture utilizes desktop capture frameworks to isolate meeting audio, you MUST toggle Clyde to <strong style="color: #00ffcc;">ON</strong> in <span style="background-color: #222; color: #00ffcc; padding: 2px 4px; font-family: monospace;">System Settings → Privacy & Security → Screen & System Audio Recording</span>.</li>
</ul>

<div style="background-color: #330000; border: 2px solid #ff3333; color: #ffffff; padding: 15px; border-radius: 6px; margin: 15px 0;">
  <strong style="color: #ff3333; font-size: 1.1rem;">⚠️ Dead Silence? Check the Indicator!</strong><br/>
  During an active call, look at the microphone icon in Clyde's bottom control bar. If it isn't pulsing, Clyde isn't getting any audio. Try clicking the mic icon directly—it acts as a quick mute/unmute and capture pause switch!
</div>`
    },
    {
      id: 'cloud-providers-setup',
      category: 'desktop',
      categoryLabel: 'Clyde Desktop App',
      title: 'Setting Up Cloud Providers: OpenAI, Anthropic, and Gemini',
      summary: "Step-by-step instructions on adding API keys, picking models, configuring endpoints, and running validations for Clyde's cloud-based AI.",
      content: `<h3 style="color: #ffff00; border-bottom: 1px solid #ffff00; padding-bottom: 4px;">Unleashing Frontier Models</h3>
<p>If you aren't running local AI models, Clyde hooks up directly to top-tier cloud models using your own API keys. This keeps costs pennies-per-call, avoids expensive monthly mockups, and gives you access to state-of-the-art reasoning engines during live interviews and meetings.</p>

<h3 style="color: #ffff00; border-bottom: 1px solid #ffff00; padding-bottom: 4px;">Supported Providers & Models</h3>
<p>Clyde allows you to mix and match models for different jobs. Go to <span style="background-color: #222; color: #00ffcc; padding: 2px 4px; font-family: monospace;">Settings → LLM</span> to configure these options:</p>
<ul style="list-style-type: square; padding-left: 20px; color: #e0e0e0;">
  <li style="margin-bottom: 8px;"><strong style="color: #00ffcc;">OpenAI:</strong> Paste your OpenAI API key. We recommend <code style="color: #00ffcc; font-family: monospace;">gpt-4o</code> for general assistant duties, screenshot analysis, and post-session grading. For ultra-low latency transcription, configure <code style="color: #00ffcc; font-family: monospace;">OpenAI Realtime Whisper</code> using the same key.</li>
  <li style="margin-bottom: 8px;"><strong style="color: #00ffcc;">Anthropic:</strong> Paste your Claude API key. Claude models like <code style="color: #00ffcc; font-family: monospace;">claude-3-5-sonnet</code> are elite at tracking complex technical interview steps and providing beautifully written, conversational answer nudges.</li>
  <li style="margin-bottom: 8px;"><strong style="color: #00ffcc;">Google Gemini:</strong> Paste your Gemini key. Use Gemini models for incredibly fast summaries and large-context reasoning. You can also configure Gemini as your embedding provider for our Semantic RAG.</li>
</ul>

<h3 style="color: #ffff00; border-bottom: 1px solid #ffff00; padding-bottom: 4px;">Validation: Stop Guessing, Test Now</h3>
<p>Once you paste your API key and configure your model names, don't just hope for the best. Head over to <span style="background-color: #222; color: #00ffcc; padding: 2px 4px; font-family: monospace;">Settings → General</span> and click <strong style="color: #00ffcc;">Validate services</strong>. Clyde will instantly ping each endpoint and let you know if your keys are valid, models are active, and connections are clean.</p>

<div style="background-color: #1a0033; border: 2px solid #00ffcc; color: #ffffff; padding: 15px; border-radius: 6px; margin: 15px 0;">
  <strong style="color: #ffff00; font-size: 1.1rem;">💡 Hybrid Configuration Trick</strong><br/>
  Many users configure <strong style="color: #00ffcc;">OpenAI Realtime Whisper</strong> for blazing-fast, word-by-word transcription, but set their standard assistant provider to <strong style="color: #ff3366;">Anthropic Claude 3.5 Sonnet</strong>. This gives you speed on the input and maximum intelligence on the output!
</div>`
    },
    {
      id: 'local-lm-studio',
      category: 'desktop',
      categoryLabel: 'Clyde Desktop App',
      title: 'Private Mode: Local LM Studio & Offline Whisper',
      summary: 'Keep your secrets secret. Learn how to run Clyde fully on-device by routing your LLM through LM Studio and transcribing locally with Whisper.',
      content: `<h3 style="color: #ff00ff; border-bottom: 1px solid #ff00ff; padding-bottom: 4px;">Zero Cloud Footprint</h3>
<p>For sensitive enterprise meetings, proprietary code discussions, or just peace of mind, Clyde supports a 100% offline pipeline. By hooking Clyde up to <strong style="color: #00ffcc;">LM Studio</strong> and a local Whisper server, your audio waves, transcribed text, system prompts, and notes never leave your physical device.</p>

<h3 style="color: #ff00ff; border-bottom: 1px solid #ff00ff; padding-bottom: 4px;">Step 1: Setting Up LM Studio</h3>
<p>LM Studio makes running open-source LLMs incredibly simple. Here's how to route Clyde's brains locally:</p>
<ul style="list-style-type: decimal; padding-left: 20px; color: #e0e0e0;">
  <li style="margin-bottom: 8px;">Download and install LM Studio, then fetch an OpenAI-compatible model (we love <code style="color: #00ffcc; font-family: monospace;">Llama-3-8B-Instruct</code> or <code style="color: #00ffcc; font-family: monospace;">Mistral-7B-Instruct</code>).</li>
  <li style="margin-bottom: 8px;">Navigate to the Local Server tab (double-arrow icon) in LM Studio.</li>
  <li style="margin-bottom: 8px;">Set the port (default is usually <code style="color: #00ffcc; font-family: monospace;">1234</code>) and click <strong style="color: #ff3366;">Start Server</strong>.</li>
</ul>

<h3 style="color: #ff00ff; border-bottom: 1px solid #ff00ff; padding-bottom: 4px;">Step 2: Connecting Clyde to Your Local LLM</h3>
<p>Now, let's wire Clyde to point to your offline engine:</p>
<ul style="list-style-type: circle; padding-left: 20px; color: #e0e0e0;">
  <li style="margin-bottom: 8px;">In Clyde, go to <span style="background-color: #222; color: #00ffcc; padding: 2px 4px; font-family: monospace;">Settings → LLM</span>.</li>
  <li style="margin-bottom: 8px;">Set your standard AI provider to <strong style="color: #00ffcc;">Local LM Studio</strong>.</li>
  <li style="margin-bottom: 8px;">Paste your endpoint URL. For LM Studio, this is typically <code style="color: #ffff00; font-family: monospace;">http://localhost:1234/v1</code>.</li>
  <li style="margin-bottom: 8px;">Enter the exact model ID loaded in LM Studio so Clyde can address it properly.</li>
</ul>

<h3 style="color: #ff00ff; border-bottom: 1px solid #ff00ff; padding-bottom: 4px;">Step 3: Offline Local Whisper Setup</h3>
<p>To avoid sending audio packets to cloud APIs, navigate to <span style="background-color: #222; color: #00ffcc; padding: 2px 4px; font-family: monospace;">Settings → Speech</span>:</p>
<ul style="list-style-type: square; padding-left: 20px; color: #e0e0e0;">
  <li style="margin-bottom: 8px;">Change your Transcription Provider to <strong style="color: #00ffcc;">Local Whisper</strong>.</li>
  <li style="margin-bottom: 8px;">Configure your local Whisper endpoint (e.g., <code style="color: #ffff00; font-family: monospace;">http://localhost:8000/v1/audio/transcriptions</code>). If you run a local whisper-asr-webservice, make sure the port is correct and matching!</li>
</ul>

<div style="background-color: #001a11; border: 2px solid #00ffcc; color: #ffffff; padding: 15px; border-radius: 6px; margin: 15px 0;">
  <strong style="color: #00ffcc; font-size: 1.1rem;">✅ Remember to Validate!</strong><br/>
  Before starting your call, go to <span style="background-color: #222; color: #00ffcc; padding: 2px 4px; font-family: monospace;">Settings → General → Validate services</span>. If validation fails, double-check that LM Studio is actually running, the model is fully loaded in memory, and the endpoint paths are typed correctly!
</div>`
    },
    {
      id: 'sound-settings',
      category: 'desktop',
      categoryLabel: 'Clyde Desktop App',
      title: 'Speech & Audio settings: Selecting Engines, Devices & Whisper Ports',
      summary: 'Make sure your voice is captured crystal-clear. Learn how to configure Rust Native Audio, choose output devices, refresh devices, and point to Local Whisper.',
      content: `<h3 style="color: #00ffcc; border-bottom: 1px solid #00ffcc; padding-bottom: 4px;">Optimizing the Audio Pipeline</h3>
<p>Clyde's superpower is splitting and capturing sound from multiple sources simultaneously: your local physical microphone (your voice) and the virtual output driver (the meeting attendees' voices). Getting these sound lines configured correctly is key to clean transcripts.</p>

<h3 style="color: #00ffcc; border-bottom: 1px solid #00ffcc; padding-bottom: 4px;">Rust Native Audio vs. Legacy Recorder</h3>
<p>In <span style="background-color: #222; color: #00ffcc; padding: 2px 4px; font-family: monospace;">Settings → Speech</span>, you can toggle between two audio processing engines:</p>
<ul style="list-style-type: square; padding-left: 20px; color: #e0e0e0;">
  <li style="margin-bottom: 8px;"><strong style="color: #00ffcc;">Rust Native Audio (Recommended):</strong> Our blazingly fast, custom-built native audio pipeline. It utilizes low-level OS hooks, consumes minimal CPU, and handles multi-device aggregation flawlessly. It has a built-in noise gate and automatic audio level balancing.</li>
  <li style="margin-bottom: 8px;"><strong style="color: #ff3366;">Legacy Recorder:</strong> A fallback electron-based recorder. Useful if you have complex virtual soundboards or specialized virtualization software that blocks low-level OS hooks.</li>
</ul>

<h3 style="color: #00ffcc; border-bottom: 1px solid #00ffcc; padding-bottom: 4px;">Device Selection & Re-Scanning</h3>
<p>To avoid taking audio from the wrong webcam mic or sending it to an inactive headset, configure your routing manually:</p>
<ul style="list-style-type: decimal; padding-left: 20px; color: #e0e0e0;">
  <li style="margin-bottom: 8px;"><strong style="color: #ffff00;">Microphone Selection:</strong> Choose your main talking input device from the dropdown list.</li>
  <li style="margin-bottom: 8px;"><strong style="color: #ffff00;">System Audio Selection:</strong> Choose the device capturing the other side's voice (your headphones or speaker device).</li>
  <li style="margin-bottom: 8px;"><strong style="color: #00ffcc;">Refresh Devices:</strong> Plugged in a new USB microphone mid-app? Don't restart Clyde! Just click the <strong style="color: #00ffcc;">Refresh devices</strong> button to instantly re-scan your computer's audio slots.</li>
</ul>

<h3 style="color: #00ffcc; border-bottom: 1px solid #00ffcc; padding-bottom: 4px;">Whisper Port Configuration</h3>
<p>If you're using <strong style="color: #00ffcc;">Local Whisper</strong>, Clyde communicates via HTTP requests. Your endpoint URL should point directly to the port where your local transcriber is running (usually port <code style="color: #ffff00; font-family: monospace;">8000</code> or <code style="color: #ffff00; font-family: monospace;">5000</code>). Ensure the URL reads <code style="color: #00ffcc; font-family: monospace;">http://localhost:PORT/v1/audio/transcriptions</code> so Clyde can POST audio chunks for immediate translation into text.</p>

<div style="background-color: #1a0033; border: 2px solid #ff3366; color: #ffffff; padding: 15px; border-radius: 6px; margin: 15px 0;">
  <strong style="color: #00ffcc; font-size: 1.1rem;">🎧 Speaker Detection Hint</strong><br/>
  Clyde separates speakers by tracking which device input generated the audio chunk. If your system audio is bleeding into your mic input (like playing meeting sound through desktop speakers), turn down your speaker volume or switch to headphones to prevent Clyde from misidentifying speakers!
</div>`
    },
    {
      id: 'live-call-recording-setup',
      category: 'audio',
      categoryLabel: 'Audio & Transcription',
      title: 'Running Live Calls, Screen Analysis, and Recording Workflows',
      summary: 'Learn how to execute live calls in Clyde using the preflight check, real-time transcription, desktop screenshot analysis, and safe session saving.',
      content: `<h3>1. Preflight Readiness Assessment</h3><p>Before launching a live call, clicking the <strong>Start</strong> button opens Clyde's Preflight Check modal. This critical safety step allows you to verify several components before any recording begins:</p><ul><li><strong>Active Context:</strong> Confirm that the session is tied to the correct opportunity or meeting so that transcripts, summaries, and action items are saved to the proper entity.</li><li><strong>AI Provider Verification:</strong> See at a glance which LLM and transcription services are validated and active.</li><li><strong>Capture Protection Status:</strong> Verify if Clyde's UI overlay safety feature is active to prevent the app from being captured in external recordings.</li><li><strong>Linked Q&A Pairs:</strong> Review how many customized questions from the Question Bank are loaded and primed for the active call.</li></ul><h3>2. Real-Time Transcription & Speaker Separation</h3><p>Once you pass the preflight check and initiate recording, Clyde captures audio streams from both your microphone and your system's output (the other party's voice). Using your configured transcription service (such as Local Whisper or OpenAI Whisper), Clyde separates turns by speaker and populates a scrolling live transcript. The turns are shown in a chat-bubble interface, where your utterances appear on the right side and the other caller's comments appear on the left, making the conversation structure easy to follow at a glance.</p><h3>3. Custom 'Ask Clyde' Prompts and Screenshot Analysis</h3><p>At any point during the call, you can type directly into the input pill at the bottom of the capture window. The <strong>Ask Clyde</strong> input allows you to request instant help, such as explaining technical terms, suggesting counter-arguments, or identifying risks. Additionally, you can utilize visual intelligence:</p><ul><li><strong>1-Click Screenshot (Camera Button):</strong> Click the camera icon in the input pill to capture your desktop. Clyde uses your vision-capable LLM to analyze slide decks, code snippets, charts, or shared diagrams instantly.</li><li><strong>Include Screenshot Toggle:</strong> Toggle this switch to attach a real-time screen capture to your next typed prompt, allowing you to ask hyper-specific questions about what is currently visible on screen.</li></ul><h3>4. Stop, Save, and Export Options</h3><p>When the call finishes, clicking the <strong>Stop</strong> button automatically stops audio capture, cleans the transcript, generates concise meeting notes or interview evaluations, and extracts concrete action items. You can also export the session history dynamically: clicking the <strong>Download</strong> icon in the bottom bar exports your entire prompt history and Clyde's corresponding suggestions as a formatted Markdown file for external review.</p>`
    },
    {
      id: 'nudge-hotkey-system',
      category: 'audio',
      categoryLabel: 'Audio & Transcription',
      title: 'Deep Dive into the Nudge System and Global Hotkey Configuration',
      summary: 'Master the Nudge system in Clyde, including the manual trigger, distinct purple/indigo answer styling, and system-wide keyboard shortcut configuration.',
      content: `<h3>1. What is the Nudge System?</h3><p>The Nudge system is designed to provide immediate, low-latency suggestions for what you should say next during live, high-pressure conversations. Unlike normal prompts which might require you to formulate and type out a detailed request, Nudge is a single-action trigger. When activated, Clyde instantly reviews the most recent incoming turns in the active transcript, identifies the interviewer's last question or topic of discussion, and outputs a highly relevant talking point, counter-argument, or direct answer suggestion.</p><h3>2. Distinct Purple and Indigo Card Styling</h3><p>To prevent confusion during rapid live calls, Nudge responses do not look like standard answer cards. While regular answers are styled with the application's base color scheme, Nudge suggestions are rendered in distinct purple/indigo cards. This immediate visual cue lets you identify Nudge cards at a glance without having to read the surrounding text, allowing you to quickly spot suggested responses while maintaining eye contact and conversational flow.</p><h3>3. Configuring the Global Hotkey</h3><p>To make the Nudge system accessible while you are focused on other windows—such as Zoom, Google Meet, Microsoft Teams, or a browser-based coding environment—Clyde includes a programmable system-wide global hotkey. The default shortcut is set to <strong>Ctrl+Shift+N</strong>, but it can be fully customized:</p><ul><li>Navigate to <strong>Settings → General → Nudge hotkey</strong>.</li><li>Click inside the recording input field.</li><li>Press your preferred key combination on your keyboard (the system will record and display it in real time).</li><li>Click <strong>Clear</strong> if you want to remove the registered hotkey entirely.</li></ul><h3>4. How the Shortcut Operates System-Wide</h3><p>The global hotkey is designed with deep safety and resource efficiency in mind. The keyboard hook is only registered globally when active audio capture is running, and is immediately unregistered once the call is stopped or paused. This ensures that the hotkey does not conflict with other desktop applications during normal computer use. If you experience hotkey issues, ensure that capture is actively running, confirm that the hotkey is properly mapped in Settings, and verify that the combination is not reserved by another system-level process.</p>`
    },
    {
      id: 'pre-call-prep-strategy',
      category: 'audio',
      categoryLabel: 'Audio & Transcription',
      title: 'Configuring Pre-Call Prep Cards for Focus Alignment',
      summary: "Learn how to leverage Clyde's Pre-Call Prep page and cards to align focus, review cumulative phase summaries, and prepare tailored questions before your call starts.",
      content: `<h3>1. Accessing the Pre-Call Prep Page</h3><p>Preparation is key to interview and meeting success. The dedicated <strong>Pre-Call Prep</strong> page is easily accessible from the application sidebar, located under the 'Now' section. Rather than starting from scratch, Clyde automatically synthesizes your saved opportunity data, previous meeting transcripts, job descriptions, and resume details to build a highly targeted, structured preparation layout.</p><h3>2. Core Sections of the Pre-Call Prep Card</h3><p>When Clyde gathers sufficient context, it generates a comprehensive, context-aware preparation card. This card features four highly tailored sections to align your focus before the call begins:</p><ul><li><strong>Cumulative Phase Summary:</strong> A concise retrospective of what has been discussed and covered in previous sessions of the opportunity, ensuring you do not repeat yourself or miss critical unresolved talking points.</li><li><strong>Probable Focus:</strong> A predictive analysis of what to expect in the upcoming call phase (e.g., technical deep dive, hiring manager behavioral round, or system design) based on typical patterns in similar roles and your opportunity history.</li><li><strong>Strengths Aligned to the Role:</strong> A curated list of your core experiences, project milestones, and tech stack proficiencies matched against the active job description's explicit requirements.</li><li><strong>Questions to Ask:</strong> A series of smart, customized questions designed to impress your interviewer, formulated from gaps identified in the JD and prior conversation transcripts.</li></ul><h3>3. Quick Launch Operations</h3><p>The Pre-Call Prep card is also an action hub. Once you are done reviewing your prep card, you can use the quick-access actions at the top of the interface to jump straight into the live capture window, validate your audio and LLM service configurations, or switch to other related opportunity files instantly.</p>`
    },
    {
      id: 'question-bank-linking',
      category: 'audio',
      categoryLabel: 'Audio & Transcription',
      title: 'Managing the Question Bank and Linking Contextual Q&A Pairs',
      summary: 'Optimize your live call responses by manually adding questions, importing bulk CSV files, and linking Q&A pairs to specific active opportunities.',
      content: `<h3>1. Purpose of the Question Bank</h3><p>The <strong>Question Bank</strong> is a dedicated workspace available in Interview Mode designed to store, manage, and retrieve your personalized question-and-answer pairs. By storing your ideal responses to common behaviorals, technical challenges, or project overviews, you give Clyde's AI context engine direct access to your verified 'brag facts' and model answers. During live calls, if an interviewer asks a question that matches or relates to a bank entry, Clyde leverages that exact answer text to formulate highly accurate, personalized suggestions.</p><h3>2. Bulk Importing Q&A via CSV</h3><p>While you can add individual question-and-answer pairs manually through the user interface, Clyde provides a bulk import feature to streamline your onboarding workflow:</p><ul><li>Create a standard CSV file with two main columns: <strong>Question</strong> and <strong>Answer</strong>.</li><li>Go to the <strong>Question Bank</strong> tab in the sidebar.</li><li>Click the <strong>Import CSV</strong> button and select your file.</li><li>Clyde parses the document and instantly populates your Question Bank dashboard.</li></ul><h3>3. Opportunity-Specific vs. Global Scopes</h3><p>To prevent Clyde's suggestion cards from being cluttered with irrelevant answers, you can control the scope of each Q&A pair:</p><ul><li><strong>Opportunity-Specific Linking:</strong> Link a Q&A pair directly to a specific active opportunity (e.g., 'Senior Product Manager at Stripe'). Clyde will only load and search this pair when that opportunity is active.</li><li><strong>Global Question Bank:</strong> For generic questions (like 'Tell me about yourself' or 'What are your salary expectations?'), keep them unscoped. You can include these in any call by toggling the <strong>Include Global</strong> setting in Settings or in the Question Bank header.</li></ul><h3>4. Preflight and Management</h3><p>All linked Q&A pairs are summarized in the Preflight Check modal, letting you confirm exactly how many specialized answers are active before recording begins. From the main Question Bank page, you can search, browse, edit, or delete any pair at any time to keep your answer database clean and current.</p>`
    },
    {
      id: 'assistant-vs-pro-agent',
      category: 'audio',
      categoryLabel: 'Audio & Transcription',
      title: 'Clyde Assistant vs. Clyde Pro Agent Capabilities and Workflows',
      summary: 'Understand the differences between Clyde Assistant (Free) and Clyde Pro Agent (Pro), including observational bounds, sync triggers, autonomous actions, and mock scorecards.',
      content: `<h3>1. Observational Bounds and Core Memory</h3><p>Clyde offers two levels of artificial intelligence workflows to accommodate different needs. The free tier includes <strong>Clyde Assistant</strong>, which is constrained to localized, immediate-context help. It is ideal for active-context support during a single call, floating chat interactions, and answering queries based on the currently open meeting or interview. The premium tier unlocks <strong>Clyde Pro Agent</strong>, which expands the AI's observational boundaries to cross-opportunity memory, global file semantic search (via advanced Pinecone RAG), and comprehensive trend tracking across multiple historical sessions.</p><h3>2. Google Gmail & Calendar Sync Triggers</h3><p>Clyde Pro Agent features automatic background integrations to keep your workflow synchronized without manual data entry. By enabling Google Sync in settings:</p><ul><li><strong>Triggers:</strong> Clyde periodically scans your connected Gmail inbox and Google Calendar for status updates, interview schedules, recruiter invites, offers, or rejections.</li><li><strong>Proposals:</strong> Upon detecting these triggers, Clyde Pro Agent generates sync proposals—such as 'Import interview prep email', 'Add final loop to calendar', or 'Mark opportunity as Offered'. You can review, approve, or dismiss these proposals in the Sync center.</li></ul><h3>3. Autonomous Actions and UI Approval Cards</h3><p>With autonomous updates enabled in Settings, Clyde Pro Agent can automatically transition opportunity statuses and calendar events inside the application. However, for any external or critical actions (such as sending emails or scheduling live follow-ups), Clyde adheres to a strict safety-first protocol by generating interactive <strong>Approval Cards</strong>. These cards outline the proposed changes, and Clyde waits for your explicit click-to-approve confirmation before executing them.</p><h3>4. Mock Interviews & Star-Style Scorecard Calibration</h3><p>Pro users gain access to advanced prep tools such as the Realtime Mock Interview module, which leverages a low-latency voice agent model to conduct realistic practice rounds. After completing a practice or live session, Clyde Pro Agent generates a detailed <strong>0-100 Scorecard</strong>. This scorecard measures key performance categories, highlights strengths and risks, and provides a concrete improvement plan. These scorecards are then saved into your long-term memory store, allowing Clyde to calibrate your overall performance trends and confidence metrics over time.</p>`
    },
    {
      id: 'go-google-sync-proposals',
      category: 'go',
      categoryLabel: 'Clyde Go (Extension)',
      title: 'Troubleshooting Google Sync: Gmail Invitation Scanning & Calendar Proposals',
      summary: "How Clyde's background sync engine scans Gmail invites, proposes calendar updates, maintains poll intervals, and logs operations in the Audit Log.",
      content: `<h3>How Google Sync Works</h3><p>For Clyde Pro users, the calendar sync background worker periodically polls Gmail and Google Calendar to automatically surface upcoming meetings and job opportunities. This integration scans the content of incoming emails for interview invites, schedule updates, and next-round signals.</p><h3>Poll Intervals & Performance</h3><p>To avoid hitting Google API rate limits while keeping your workspace fresh, Clyde uses a configurable poll interval (defaulting to 15 minutes). During each poll, Clyde performs the following tasks:</p><ul><li><strong>Gmail Scanning:</strong> Checks for emails from recruiter addresses containing keywords like "interview", "schedule", "meet", "offer", or "reject".</li><li><strong>Calendar Discovery:</strong> Identifies new meetings with external participants that look like interviews.</li><li><strong>Candidate Tracking:</strong> Automatically extracts details like company name, interviewer names, and roles.</li></ul><h3>Sync Proposals vs. Autonomous Updates</h3><p>By default, when Clyde detects a new event or status update, it does not modify your data directly. Instead, it generates a <strong>Sync Proposal</strong> on your dashboard. You can approve or dismiss actions such as:</p><ul><li>Adding a final loop or technical round to your calendar.</li><li>Importing a preparation email with a job description.</li><li>Marking an opportunity status as Advanced or Rejected based on email content.</li></ul><p>If you prefer an automated experience, you can toggle on <strong>Autonomous Updates</strong> in Settings, which lets Clyde keep opportunity statuses and calendar items current without manual confirmation.</p><h3>Reviewing the Audit Log</h3><p>If a calendar event fails to sync or an email is not parsed, check the <strong>Audit Log</strong> under <strong>Settings → Sync</strong>. The Audit Log tracks every sync attempt, showing timestamps, action statuses, and any error messages received from the Google API.</p>`
    },
    {
      id: 'go-opportunity-tracking-states',
      category: 'go',
      categoryLabel: 'Clyde Go (Extension)',
      title: 'Managing Opportunity States & Recurring Meeting Contexts',
      summary: 'A deep dive into opportunity state transitions, outcomes calibration, and tracking recurring meeting types like Product Weekly or Customer Calls.',
      content: `<h3>Understanding Opportunity States</h3><p>The Opportunity Tracker allows candidates to manage their entire recruitment lifecycle. Each opportunity moves through a series of formal states:</p><ul><li><strong>Active:</strong> Currently interviewing or preparing.</li><li><strong>Advanced:</strong> Moved forward to subsequent rounds (e.g., technical or final loop).</li><li><strong>Offered:</strong> Received a formal offer.</li><li><strong>Rejected:</strong> Application or interview process concluded without an offer.</li></ul><h3>State Transitions & Outcomes Calibration</h3><p>Transitioning opportunities to their correct terminal states (Offered or Rejected) is vital. Clyde's <strong>Confidence Calibration Engine</strong> uses historical ratings and outcomes to predict your performance. By marking old opportunities as offered or rejected, you calibrate the grading algorithm. Note that the active opportunity is always excluded from its own calibration set to maintain unbiased scoring.</p><h3>Recurring Meeting Contexts</h3><p>Clyde isn't just for interviews—Meeting Mode supports structured recurring contexts. You can create permanent contexts such as:</p><ul><li><strong>Product Weekly:</strong> Focuses on feature timelines, blockers, and product updates.</li><li><strong>Investor Updates:</strong> Highlights key metrics, growth charts, and strategic decisions.</li><li><strong>Customer Calls:</strong> Perfect for capturing feature requests, bugs, and direct feedback.</li></ul><p>Once a session concludes, Clyde processes the transcript and groups action items by attendee for easy follow-up.</p>`
    },
    {
      id: 'go-extension-overview',
      category: 'go',
      categoryLabel: 'Clyde Go (Extension)',
      title: 'Clyde Go Chrome Extension: The Browser Copilot',
      summary: 'How the Clyde Go Chrome extension integrates with Clyde Desktop, clips jobs, and analyzes roles against your Master Resume with matching scores.',
      content: `<h3>Introducing Clyde Go</h3><p>Clyde Go is the companion Chrome extension designed to streamline the top-of-funnel application pipeline. While Clyde Desktop serves as your real-time overlay assistant during calls, Clyde Go lives in your browser to capture job descriptions and automate application forms.</p><h3>Job Clipping & Master Resume Analysis</h3><p>When browsing jobs on LinkedIn, Indeed, or company boards, Clyde Go lets you clip roles directly into your Clyde workspace. The extension performs a real-time comparison against your Master Resume:</p><ul><li><strong>Match Score:</strong> Computes a 0.0 to 5.0 rating indicating your alignment with the role's requirements.</li><li><strong>Key Strengths:</strong> Highlights the exact experiences and bullet points on your resume that match the job description.</li><li><strong>Candidate Gaps:</strong> Identifies missing skills, technologies, or experience levels that you should address.</li><li><strong>Interview Mitigations:</strong> Generates speaking points and tailored answers to handle those gaps during a live call.</li></ul><h3>1-Click Form Filling</h3><p>Clyde Go integrates with major Applicant Tracking Systems (ATS) including Greenhouse, Lever, Ashby, and Workday. It parses form fields and injects your structured applicant profile with one click, saving hours of manual data entry.</p>`
    },
    {
      id: 'go-workday-hydration-lag',
      category: 'go',
      categoryLabel: 'Clyde Go (Extension)',
      title: 'Resolving Workday Form Submission Failures & React Hydration Lag',
      summary: 'Why auto-filled fields on Workday or Greenhouse portals might disappear upon clicking submit, and how Clyde Go bypasses React state hydration delay.',
      content: `<h3>The Symptom</h3><p>When using Clyde Go's 1-click form-filling on enterprise HR gateways like Workday, Greenhouse, or Taleo, the inputs appear to fill out correctly with your graduation year, GPA, or work history. However, upon clicking the "Submit" or "Next" button, these fields suddenly clear out or throw "Required Field" validation errors.</p><h3>The React Hydration Bottleneck</h3><p>Modern enterprise portals are built on heavily throttled React single-page frameworks. When an extension modifies the DOM node's <code>value</code> attribute directly and rapidly, React's virtual DOM state handlers do not recognize the change. Since no physical keyboard event was fired, React's synthetic event system never triggers, leaving the React state blank. When you submit, React posts its internal state (which is empty) rather than the visible DOM values.</p><h3>How Clyde Go Resolves This</h3><p>To bypass this hydration lag, Clyde Go employs a multi-step injection pipeline:</p><ul><li><strong>150ms Post-Hydration Delay:</strong> Clyde Go v2.4.1+ introduces a native 150ms delay between field discovery and input injection, allowing Workday's background scripts to finish loading and binding to the DOM.</li><li><strong>Synthetic Event Dispatch:</strong> Instead of simply setting the <code>.value</code> property, Clyde Go programmatically dispatches native <code>input</code> and <code>change</code> events on every filled element to force React's state tree to hydrate.</li></ul><h3>Manual Workaround</h3><p>If a custom or heavily modified form field still fails to bind, select the input box, type a single character (such as Space), and delete it. This manual keystroke triggers the physical keyboard events that force the React state to sync with the visual DOM value.</p>`
    },
    {
      id: 'go-mv3-security-boundaries',
      category: 'go',
      categoryLabel: 'Clyde Go (Extension)',
      title: 'Manifest V3 Security Boundaries & Tab Privilege Isolation in Clyde Go',
      summary: 'How Clyde Go secures your user data and Pro credits through strict privilege isolation, CSP sandboxing, and secure background workers.',
      content: `<h3>The Manifest V3 Security Standard</h3><p>Clyde Go is engineered on Google Chrome's Manifest V3 (MV3) platform. MV3 mandates a modern security model that restricts extensions from executing arbitrary remote scripts and requires strict boundaries between different extension execution environments.</p><h3>Privilege Isolation & Firewalling</h3><p>To protect your account and Clyde Pro credits, Clyde Go maintains a rigid firewall between on-page content scripts and privileged background service workers:</p><ul><li><strong>Content Scripts:</strong> These scripts execute in an isolated world on the active web page to parse job descriptions and fill fields. They have access to the page's DOM but have zero access to your API keys, subscription tokens, or database.</li><li><strong>Background Service Workers:</strong> These background processes handle authentication, API queries, and licensing. They do not run on the web page and cannot be directly targeted by web page scripts.</li></ul><h3>Preventing Message Spoofing & Origin Leaks</h3><p>Communication between the content script and background worker occurs via Chrome's message passing APIs. To prevent malicious web pages from spoofing message requests and draining your AI credits, Clyde Go implements strict origin validation:</p><pre><code>chrome.runtime.onMessage.addListener((message, sender, sendResponse) =&gt; {
  if (sender.tab) {
    // Restrict messages originating from web pages from triggering privileged actions
    const allowedActions = ['GET_PAGE_TEXT', 'FILL_FIELD_CONFIRM'];
    if (!allowedActions.includes(message.action)) return false;
  }
});</code></pre><h3>Content Security Policy (CSP) & Sandboxing</h3><p>Clyde Go uses a strict Content Security Policy that forbids unsafe-eval and remote code loading. All parsing models and matching logic are compiled locally within the extension package. Sandboxed frames are utilized for rendering custom preview screens, ensuring that page-level cross-site scripting (XSS) cannot leak user resumes or tokens.</p>`
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
    <main className="kb-page support-page">
      <section className="subpage-hero policy-hero" style={{ paddingBottom: '20px' }}>
        <div className="subpage-copy">
          <span className="eyebrow" style={{ color: 'var(--cyan)' }}>Self-Service Runbooks</span>
          <h1 style={{ fontSize: '3rem', lineHeight: '1.15', marginBottom: '20px' }}>Knowledge Center</h1>
          <p style={{ fontSize: '1.15rem', color: '#9ca3af', lineHeight: '1.6', maxWidth: '750px' }}>
            Detailed configurations, technical guides, troubleshooting runbooks, and manual workarounds built for Clyde Desktop and Clyde Go.
          </p>
        </div>
      </section>

      <section className="section-band policy-body" style={{ display: 'flex', justifyContent: 'center', paddingTop: '0px', paddingBottom: '80px' }}>
        <div style={{ maxWidth: '1100px', width: '100%', display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
          
          {/* Left Sidebar Filters */}
          <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Search Box */}
            <div style={{ background: 'rgba(9, 18, 28, 0.65)', border: '1px solid var(--line)', padding: '20px', borderRadius: '12px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#f1f5f9', display: 'block', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Search Articles</label>
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. Realtek, Workday, BYOK..." 
                style={{ width: '100%', background: '#030609', border: '1px solid var(--line)', borderRadius: '6px', padding: '10px', color: '#f1f5f9', fontSize: '0.85rem' }}
              />
            </div>

            {/* Categories */}
            <div style={{ background: 'rgba(9, 18, 28, 0.65)', border: '1px solid var(--line)', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#f1f5f9', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filter by Category</label>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => { setActiveCategory(cat.id); setSelectedArticle(null); }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: activeCategory === cat.id ? 'rgba(79, 231, 255, 0.15)' : 'transparent',
                    border: activeCategory === cat.id ? '1px solid var(--cyan)' : '1px solid transparent',
                    color: activeCategory === cat.id ? 'var(--cyan)' : '#9ca3af'
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Contact Card */}
            <div style={{ background: 'rgba(9, 18, 28, 0.45)', border: '1px solid var(--line)', padding: '24px', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '8px', fontWeight: 600, color: 'var(--cyan)' }}>Need direct help?</h3>
              <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '16px', lineHeight: '1.5' }}>
                Can't find a solution to your device or extension conflict? Open a technical support ticket directly.
              </p>
              <button 
                onClick={() => navigate('/support')}
                className="primary-link"
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: 'none', background: 'var(--cyan)', color: '#030609', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', textAlign: 'center' }}
              >
                Submit a Ticket
              </button>
            </div>

          </div>

          {/* Right Main Column */}
          <div style={{ flex: '2 1 600px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {selectedArticle ? (
              /* Single Article View */
              <div style={{ background: 'rgba(9, 18, 28, 0.65)', backdropFilter: 'blur(16px)', border: '1px solid var(--line)', borderRadius: '12px', padding: '40px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {selectedArticle.categoryLabel}
                  </span>
                  <button 
                    onClick={() => setSelectedArticle(null)}
                    style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    ← Back to Articles
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h2 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>{selectedArticle.title}</h2>
                  <div 
                    className="kb-body-text"
                    style={{ fontSize: '0.95rem', color: '#cbd5e1', lineHeight: '1.7' }}
                    dangerouslySetInnerHTML={{ __html: selectedArticle.content }}
                  />
                </div>
              </div>
            ) : (
              /* Article List View */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
                <div style={{ fontSize: '0.85rem', color: '#8aa2b3', marginBottom: '4px' }}>
                  Showing {filteredArticles.length} matching articles
                </div>

                {filteredArticles.length === 0 ? (
                  <div style={{ background: 'rgba(9, 18, 28, 0.45)', border: '1px solid var(--line)', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
                    <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '8px' }}>No articles matched your search.</p>
                    <button 
                      onClick={() => { setSearchQuery(''); setActiveCategory('all'); }}
                      style={{ background: 'none', border: 'none', color: 'var(--cyan)', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem' }}
                    >
                      Clear search filters
                    </button>
                  </div>
                ) : (
                  filteredArticles.map(art => (
                    <div 
                      key={art.id}
                      onClick={() => setSelectedArticle(art)}
                      style={{
                        background: 'rgba(9, 18, 28, 0.45)',
                        border: '1px solid var(--line)',
                        borderRadius: '12px',
                        padding: '24px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--cyan)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {art.categoryLabel}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#597184' }}>Read runbook →</span>
                      </div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, color: '#f5fbff' }}>{art.title}</h3>
                      <p style={{ fontSize: '0.9rem', color: '#9ca3af', margin: 0, lineHeight: '1.5' }}>{art.summary}</p>
                    </div>
                  ))
                )}

              </div>
            )}

          </div>

        </div>
      </section>
    </main>
  );
}


export { normalizePath };
export default App;
