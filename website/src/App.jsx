import { useEffect, useMemo, useRef, useState } from 'react';
import { LiveAvatarSession, SessionEvent } from '@heygen/liveavatar-web-sdk';

const downloadHref = 'https://storage.googleapis.com/clydeai-live-downloads/clyde-windows-v1.0.0-beta.2.exe';

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
      ? <PricingPage showUpgradeNotice={showUpgradeNotice} />
    : path === '/clyde-go'
      ? <ClydeGoPage />
    : path === '/support'
      ? <SupportPage />
    : path === '/privacy-policy'
      ? <PrivacyPolicyPage />
      : path === '/terms-of-service'
        ? <TermsOfServicePage />
        : path === '/auth/confirmed'
          ? <AuthConfirmedPage />
          : path === '/billing/success'
            ? <BillingSuccessPage />
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
  return (
    <header className="site-header">
      <a className="brand-link" href="/" onClick={(event) => { event.preventDefault(); navigate('/'); }}>
        <img src="/clyde-free-logo-textonly.svg" alt="Clyde" />
      </a>
      <nav aria-label="Primary navigation">
        <a href="/" onClick={(event) => { event.preventDefault(); navigate('/'); }} className={path === '/' ? 'active' : ''}>Home</a>
        <a href="/clyde-go" onClick={(event) => { event.preventDefault(); navigate('/clyde-go'); }} className={path === '/clyde-go' ? 'active' : ''}>Clyde Go</a>
        <a href="/how-it-works" onClick={(event) => { event.preventDefault(); navigate('/how-it-works'); }} className={path === '/how-it-works' ? 'active' : ''}>How it works</a>
        <a href="/pricing" onClick={(event) => { event.preventDefault(); navigate('/pricing'); }} className={path === '/pricing' ? 'active' : ''}>Pricing</a>
        <a href="/support" onClick={(event) => { event.preventDefault(); navigate('/support'); }} className={path === '/support' ? 'active' : ''}>Support</a>
        <a href="/privacy-policy" onClick={(event) => { event.preventDefault(); navigate('/privacy-policy'); }} className={path === '/privacy-policy' ? 'active' : ''}>Privacy</a>
        <a href="#faq">FAQ</a>
      </nav>
      <div className="header-actions">
        <button className="header-cta header-pro-cta" type="button" onClick={() => navigate('/pricing')}>Get Clyde Pro</button>
        <a className="header-cta" href={downloadHref} onClick={onDownload} download>Download for Windows</a>
      </div>
      {upgradeNotice ? <span className="header-checkout-status">{upgradeNotice}</span> : null}
    </header>
  );
}

function LandingPage({ navigate, onDownload }) {
  return (
    <main>
      <section className="hero-section">
        <HeroScene />
        <div className="hero-copy" data-reveal>
          <div className="hero-logo-lockup"><img src="/green_eyes_and_headphones.svg" alt="Clyde" /></div>
          <h1>The Undetectable Agentic Partner.</h1>
          <p>
            Elevating professional execution with private, autonomous intelligence and real-time mastery.
          </p>

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

function PricingPage({ showUpgradeNotice }) {
  const [annual, setAnnual] = useState(true);
  const [proCheckout, setProCheckout] = useState({ open: false, email: '', busy: false, error: '', notice: '' });
  const [creditsCheckout, setCreditsCheckout] = useState({ open: false, email: '', busy: false, error: '', notice: '' });
  
  // Custom states for the Web Create Account modal
  const [signupModal, setSignupModal] = useState({ open: false, email: '', password: '', confirmPassword: '', busy: false, error: '' });

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
        setSignupModal({ open: true, email, password: '', confirmPassword: '', busy: false, error: '' });
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
      const response = await fetch('/api/create-credits-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || 'Credits checkout could not be started. Please try again.');
      }
      window.location.href = payload.url;
    } catch (error) {
      setCreditsCheckout((s) => ({ ...s, busy: false, error: error.message || 'Checkout could not be started.' }));
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
      priceMonthly: 9.99,
      priceAnnual: 9.99,
      description: 'Buy on-demand background credits for the Clyde Go extension. No monthly subscription required.',
      cta: 'Buy Credit Pack (100)',
      ctaClass: 'primary',
      credits: true,
      features: [
        { label: '100 background credits included', free: false, pro: false, credits: true },
        { label: 'Active-context filler', free: false, pro: false, credits: true },
        { label: 'Extension on-demand usage', free: false, pro: false, credits: true },
        { label: 'Never expires', free: false, pro: false, credits: true }
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
              <div className="description">{tier.description}</div>

              <ul className="feature-list">
                {tier.features.map((feat, i) => (
                  <li key={i}>
                    {feat[tier.name.toLowerCase()] ? (
                      <span className={`check ${tier.name.toLowerCase()}`}>✓</span>
                    ) : (
                      <span className="check free" style={{ background: 'transparent', color: 'var(--muted-2)' }}>–</span>
                    )}
                    {feat.label}
                  </li>
                ))}
              </ul>

              {tier.name === 'Pro' && proCheckout.open ? (
                <form className="pro-checkout-form" onSubmit={startProCheckout}>
                  <input
                    type="email"
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
                  {proCheckout.error ? <p className="checkout-status checkout-error">{proCheckout.error}</p> : null}
                  {proCheckout.notice ? <p className="checkout-status">{proCheckout.notice}</p> : null}
                </form>
              ) : tier.name === 'Credit Pack' && creditsCheckout.open ? (
                <form className="pro-checkout-form" onSubmit={startCreditsCheckout}>
                  <input
                    type="email"
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
                  {creditsCheckout.error ? <p className="checkout-status checkout-error">{creditsCheckout.error}</p> : null}
                </form>
              ) : (
                <button
                  className={`cta-btn ${tier.ctaClass}`}
                  onClick={() => {
                    if (tier.name === 'Pro') {
                      setProCheckout((s) => ({ ...s, open: true, error: '', notice: '' }));
                    } else if (tier.name === 'Credit Pack') {
                      setCreditsCheckout((s) => ({ ...s, open: true, error: '', notice: '' }));
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
              Welcome to <span style={{ background: 'linear-gradient(to right, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Clyde</span>
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '24px' }}>
              Sign in or create a free account to unlock your career cockpit.
            </p>

            <form onSubmit={handleWebSignupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: '#cbd5e1' }}>
                Email Address
                <input
                  type="email"
                  required
                  disabled
                  value={signupModal.email}
                  style={{
                    background: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    color: '#94a3b8',
                    fontSize: '0.9rem',
                    outline: 'none',
                    cursor: 'not-allowed'
                  }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: '#cbd5e1' }}>
                Password
                <input
                  type="password"
                  required
                  autoFocus
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
              <label>Password<input type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} /></label>
              <label>Confirm password<input type="password" value={form.confirmPassword} onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))} /></label>
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
                <a className="secondary-link tier-action" href={downloadHref} download>
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
        <a href="/clyde-go" onClick={(event) => { event.preventDefault(); navigate('/clyde-go'); }}>Clyde Go</a>
        <a href="/how-it-works" onClick={(event) => { event.preventDefault(); navigate('/how-it-works'); }}>How it works</a>
        <a href="/support" onClick={(event) => { event.preventDefault(); navigate('/support'); }}>Support</a>
        <a href="/privacy-policy" onClick={(event) => { event.preventDefault(); navigate('/privacy-policy'); }}>Privacy</a>
        <a href="/terms-of-service" onClick={(event) => { event.preventDefault(); navigate('/terms-of-service'); }}>Terms</a>
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
          background: 'linear-gradient(135deg, #00f5ff, #007aff)',
          border: 'none',
          boxShadow: '0 8px 24px rgba(0, 245, 255, 0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontSize: '24px',
          transition: 'transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        title="Chat with Clyde Support"
      >
        👻
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

function normalizePath(value) {
  if (!value || value === '/index.html') return '/';
  return value.endsWith('/') && value.length > 1 ? value.slice(0, -1) : value;
}

export default App;
