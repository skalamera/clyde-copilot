const now = new Date('2026-05-23T15:30:00.000Z');

function daysFromNow(days, hour = 15) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
}

const entities = {
  interview: [
    {
      id: 'demo-orion-labs',
      name: 'Orion Labs',
      role: 'Staff Frontend Engineer',
      kind: 'interview',
      confidence: 86,
      trend: 'up',
      outcome: 'advanced',
      outcomeReason: 'Moved to final loop after strong systems and product sense rounds.',
      outcomeDate: daysFromNow(-2),
      outcomeUpdatedAt: daysFromNow(-2)
    },
    {
      id: 'demo-nova-health',
      name: 'Nova Health',
      role: 'Senior Full Stack Engineer',
      kind: 'interview',
      confidence: 68,
      trend: 'sideways',
      outcome: 'active',
      outcomeReason: '',
      outcomeDate: '',
      outcomeUpdatedAt: ''
    },
    {
      id: 'demo-apex-fintech',
      name: 'Apex Fintech',
      role: 'Engineering Manager, Platform',
      kind: 'interview',
      confidence: 74,
      trend: 'up',
      outcome: 'offer',
      outcomeReason: 'Offer received after leadership loop.',
      outcomeDate: daysFromNow(-9),
      outcomeUpdatedAt: daysFromNow(-9)
    },
    {
      id: 'demo-helio-ai',
      name: 'Helio AI',
      role: 'Principal Product Engineer',
      kind: 'interview',
      confidence: 41,
      trend: 'down',
      outcome: 'rejected',
      outcomeReason: 'Role shifted toward ML infrastructure depth.',
      outcomeDate: daysFromNow(-14),
      outcomeUpdatedAt: daysFromNow(-14)
    }
  ],
  meeting: [
    { id: 'demo-product-weekly', name: 'Product Weekly', role: 'Cross-functional planning', kind: 'meeting', confidence: 78, trend: 'up' },
    { id: 'demo-investor-update', name: 'Investor Update', role: 'Metrics and narrative', kind: 'meeting', confidence: 64, trend: 'neutral' },
    { id: 'demo-team-retro', name: 'Team Retro', role: 'Delivery health', kind: 'meeting', confidence: 71, trend: 'up' }
  ]
};

const sessions = [
  session('demo-session-orion-recruiter', 'interview', entities.interview[0], 'Recruiter Screen', -28, 4, [
    ['Recruiter', 'Walk me through the parts of your background that map best to this Staff Frontend role.'],
    ['Candidate', 'Most of my recent work has been designing React platforms where design systems, performance, and observability have to scale across multiple product teams.'],
    ['Recruiter', 'What would make you successful in the first 90 days?'],
    ['Candidate', 'I would map the critical UI surfaces, identify latency and accessibility gaps, and ship one visible improvement while building trust with product and design.']
  ], 79, sections({
    overall: 'You showed strong alignment with the Staff Frontend role by connecting platform architecture, design systems, and measurable product impact to Orion Labs needs.',
    evidence: 'You cited multi-team React platform work, performance instrumentation, and accessibility improvements as examples of operating beyond feature delivery.',
    risks: 'Your answer was broad in the recruiter screen and would benefit from one concise story with a metric, scope, and stakeholder outcome.',
    outlook: 'You are positioned well for technical rounds if you lead with system-level ownership and keep examples grounded in business impact.'
  })),
  session('demo-session-orion-technical', 'interview', entities.interview[0], 'Technical Deep Dive', -17, 5, [
    ['Interviewer', 'Design a collaborative dashboard that updates in real time for thousands of users.'],
    ['Candidate', 'I would separate presence from document state, use server-authored events for mutations, and give the client optimistic rendering with conflict-aware reconciliation.'],
    ['Interviewer', 'How would you keep it fast?'],
    ['Candidate', 'Virtualize expensive views, split subscriptions by document section, and instrument input latency, event fanout, and commit duration as first-class metrics.']
  ], 88, sections({
    overall: 'You delivered a senior system-design answer with clear boundaries between presence, document state, realtime events, and optimistic rendering.',
    evidence: 'You named concrete scaling levers: server-authored mutations, subscription partitioning, virtualization, input-latency tracking, event fanout metrics, and commit-duration monitoring.',
    risks: 'The answer could go one layer deeper on data retention, offline recovery, and how you would debug event ordering issues in production.',
    outlook: 'This round materially improved your Orion signal because it showed Staff-level architecture judgment and production-minded observability.'
  })),
  session('demo-session-orion-product', 'interview', entities.interview[0], 'Product Sense', -5, 4, [
    ['Interviewer', 'How would you decide whether to rebuild or incrementally improve a fragile feature?'],
    ['Candidate', 'I would quantify user-visible cost, maintenance drag, and sequencing risk, then pick the smallest migration path that creates measurable confidence every sprint.'],
    ['Interviewer', 'Give an example of influencing without authority.'],
    ['Candidate', 'I aligned design, API, and QA around a shared launch checklist after showing how late accessibility misses were creating release churn.']
  ], 91, sections({
    overall: 'You gave an excellent product-sense answer that balanced user-visible value, engineering risk, and sequencing discipline.',
    evidence: 'You framed rebuild-versus-incremental decisions around user cost, maintenance drag, migration confidence, and release sequencing instead of defaulting to a rewrite.',
    risks: 'You should be ready for follow-ups about how you would convince skeptical executives when short-term delivery pressure conflicts with platform quality.',
    outlook: 'Your trajectory is upward. For the final loop, emphasize how you influence roadmap decisions without owning every team directly.'
  })),
  session('demo-session-nova-screen', 'interview', entities.interview[1], 'Hiring Manager', -10, 3, [
    ['Manager', 'Tell me about a hard production issue.'],
    ['Candidate', 'A checkout release degraded conversion because a feature flag path bypassed caching. I led rollback, root cause, and added synthetic tests around the flag matrix.'],
    ['Manager', 'Where do you want to grow?'],
    ['Candidate', 'I want deeper exposure to healthcare data workflows and compliance-driven product decisions.']
  ], 70, sections({ overall: 'You gave a credible production-ownership story, but the answer needs sharper healthcare relevance.', evidence: 'You explained rollback, root cause, and synthetic tests around a feature-flag cache miss.', risks: 'You did not yet connect the incident to clinical user trust, auditability, or compliance constraints.', outlook: 'You remain viable if the next round shows stronger domain curiosity and patient-workflow empathy.' })),
  session('demo-session-nova-tech', 'interview', entities.interview[1], 'Pairing Exercise', -3, 3, [
    ['Interviewer', 'Implement filtering and pagination for a patient task list.'],
    ['Candidate', 'I will keep filters URL-addressable, debounce text input, and avoid coupling pagination state to fetched rows.'],
    ['Interviewer', 'What edge cases would you test?'],
    ['Candidate', 'Empty states, stale pages after filter changes, permission-filtered records, and keyboard navigation through result rows.']
  ], 66, sections({ overall: 'Your implementation instincts were solid, especially around URL-addressable filters and stale pagination states.', evidence: 'You named empty states, permission-filtered rows, keyboard navigation, and filter-reset behavior as test cases.', risks: 'Time management was uneven and your explanation sometimes trailed the code instead of guiding the interviewer.', outlook: 'Practice narrating intent before implementation so the panel sees senior judgment while you code.' })),
  session('demo-session-apex-loop', 'interview', entities.interview[2], 'Leadership Loop', -16, 5, [
    ['VP Engineering', 'How do you manage platform teams without becoming a ticket router?'],
    ['Candidate', 'I set explicit product-facing outcomes for reliability, developer velocity, and cost, then reserve capacity for leverage work rather than only intake.'],
    ['VP Engineering', 'Describe a difficult performance conversation.'],
    ['Candidate', 'I separated impact from intent, gave specific examples, and paired a clear bar with weekly feedback until the engineer either recovered or had a humane transition.']
  ], 84, sections({ overall: 'You showed mature leadership judgment and a strong platform operating model.', evidence: 'You tied team strategy to reliability, developer velocity, cost, humane feedback, and capacity reservation for leverage work.', risks: 'Be prepared to discuss how you balance platform roadmap autonomy with urgent product-team asks.', outlook: 'The offer signal is strong because your examples showed both people leadership and systems thinking.' })),
  session('demo-session-helio-ml', 'interview', entities.interview[3], 'ML Systems Screen', -21, 2, [
    ['Interviewer', 'How would you design an embedding evaluation pipeline?'],
    ['Candidate', 'I would start with offline labeled sets and retrieval metrics, then compare production cohorts once the index changes are safe to roll out.'],
    ['Interviewer', 'What model-serving bottlenecks have you handled personally?'],
    ['Candidate', 'I have been adjacent to serving work, mostly focused on product integration and observability rather than low-level inference optimization.']
  ], 48, sections({ overall: 'You were honest and structured, but the role required deeper ML infrastructure ownership than your examples demonstrated.', evidence: 'You described offline evaluation sets and retrieval metrics, but acknowledged limited hands-on model-serving experience.', risks: 'The gap is not communication; it is direct ownership of inference, embeddings evaluation, and serving bottlenecks.', outlook: 'For similar roles, target product-engineering AI positions unless you can prepare deeper ML systems examples.' })),
  session('demo-session-product-weekly', 'meeting', entities.meeting[0], 'Roadmap Risk Review', -4, 4, [
    ['PM', 'The onboarding experiment is blocked on analytics signoff.'],
    ['Design', 'We can ship the simplified variant first if event naming is finalized today.'],
    ['Engineering', 'I will split the rollout and add guardrail metrics so we can learn without exposing every user.']
  ], 0, meetingNotes({
    overview: '✨ Clyde turned this roadmap risk review into a launch-ready plan: unblock analytics naming today, ship the simplified onboarding variant first, and use a guarded rollout so the team can learn quickly without exposing every user.',
    sections: {
      '🎯 Meeting summary': 'The group aligned on a lower-risk path for the onboarding experiment. Instead of waiting for the full experience, the team will finalize analytics event names, release a simplified variant, and monitor activation quality with guardrail metrics.',
      '🔥 Highlights': 'The strongest moment was Engineering proposing a split rollout with measurable guardrails. Design also created momentum by offering a simplified variant that preserves learning value while reducing launch scope.',
      '🧠 Key topics': 'Analytics signoff, event naming consistency, onboarding activation, staged rollout strategy, design QA coverage, guardrail metrics, and how to avoid learning from polluted or incomplete data.',
      '✅ Decisions': 'Ship the simplified onboarding variant first once event naming is approved. Use staged exposure instead of broad release. Treat analytics correctness as a launch blocker, not a post-launch cleanup task.',
      '⚠️ Risks and blockers': 'Analytics signoff is still the critical blocker. If event naming drifts, experiment results may become hard to trust. The simplified variant also needs focused design QA so the reduced scope does not feel unfinished.',
      '📌 Clyde follow-up': 'Clyde should watch the next Product Weekly for analytics approval, remind Engineering to confirm guardrail thresholds, and surface this rollout plan during the next onboarding discussion.'
    },
    actionItems: [
      { attendee: 'PM', items: ['📊 Get analytics signoff on final event names today.', '🧭 Define the decision criteria for whether the simplified variant graduates to broader rollout.'] },
      { attendee: 'Design', items: ['🎨 Complete QA pass on the simplified onboarding flow before rollout.', '📝 Document any intentional UX tradeoffs made to reduce scope.'] },
      { attendee: 'Engineering', items: ['🚦 Split rollout behind staged exposure controls.', '📈 Add guardrail metrics for activation quality, drop-off, and unexpected error rates.'] }
    ]
  })),
  session('demo-session-investor-update', 'meeting', entities.meeting[1], 'April Metrics Prep', -8, 3, [
    ['CEO', 'We need a concise explanation for expansion revenue.'],
    ['Ops', 'The strongest driver is seat growth in three enterprise accounts.'],
    ['Product', 'We should connect that to admin workflow adoption, not just sales activity.']
  ], 0, meetingNotes({
    overview: '💼 Clyde shaped this investor-prep conversation into a tighter expansion story: enterprise seat growth is the headline, but the real narrative is admin workflow adoption creating durable account expansion.',
    sections: {
      '🎯 Meeting summary': 'The team refined the April metrics narrative for investors. Expansion revenue should be explained through three enterprise accounts, with Product tying the growth to admin workflow adoption rather than treating it as isolated sales activity.',
      '📈 Highlights': 'Ops identified the clearest revenue driver, and Product strengthened the story by connecting revenue to product usage. This makes the update sound operationally grounded instead of purely commercial.',
      '🧠 Key topics': 'Expansion revenue, enterprise seat growth, admin workflow adoption, investor narrative clarity, account-level evidence, sales versus product attribution, and how to make metrics defensible.',
      '✅ Decisions': 'Lead with seat growth in three enterprise accounts. Support the claim with admin workflow adoption. Avoid over-crediting sales activity without product usage evidence.',
      '⚠️ Risks and open questions': 'The team still needs account-level proof points and one concise metric that links admin adoption to expansion. Without that bridge, the narrative may sound anecdotal.',
      '📌 Clyde follow-up': 'Clyde should preserve this framing for the investor rehearsal, pull related account notes into active context, and prompt the CEO to use adoption language when discussing expansion revenue.'
    },
    actionItems: [
      { attendee: 'CEO', items: ['🎙️ Rewrite the expansion revenue section into a 30-second investor-ready narrative.', '❓ Prepare one backup answer for why expansion is durable beyond this quarter.'] },
      { attendee: 'Ops', items: ['🏢 Pull seat-growth details for the three enterprise accounts.', '📊 Verify expansion numbers against the latest April metrics snapshot.'] },
      { attendee: 'Product', items: ['🧩 Add admin workflow adoption evidence to support the revenue story.', '🔍 Identify one product usage metric that correlates with seat expansion.'] }
    ]
  })),
  session('demo-session-retro', 'meeting', entities.meeting[2], 'Sprint Retro', -1, 4, [
    ['Engineer', 'Review queues are still the biggest source of cycle time.'],
    ['Designer', 'Earlier pairing helped on the billing flow.'],
    ['Lead', 'Next sprint we will cap WIP and pre-schedule design review blocks.']
  ], 0, meetingNotes({
    overview: '🛠️ Clyde summarized the retro into a focused delivery-health plan: reduce review queue drag, keep design pairing earlier in the process, and protect review time before work piles up.',
    sections: {
      '🎯 Meeting summary': 'The team agreed that review queues are the biggest source of cycle-time delay. Earlier design pairing improved the billing flow, so the next sprint will cap WIP and reserve design review blocks ahead of time.',
      '🌟 Highlights': 'The discussion stayed constructive and specific. The team named the actual bottleneck, identified a behavior that worked, and converted both into concrete sprint process changes.',
      '🧠 Key topics': 'Review queue latency, WIP limits, design-review timing, billing-flow collaboration, sprint predictability, cycle-time reduction, and keeping feedback loops closer to implementation.',
      '✅ Decisions': 'Cap work in progress next sprint. Pre-schedule design review blocks. Continue early pairing on complex UX surfaces instead of waiting for late-stage review.',
      '⚠️ Watchouts': 'If review blocks are not protected, they may get consumed by ad hoc work. WIP limits also need visible enforcement or the team may drift back into too many parallel threads.',
      '📌 Clyde follow-up': 'Clyde should compare next sprint cycle time against this retro, remind the Lead about review blocks, and surface this note if review queues come up again.'
    },
    actionItems: [
      { attendee: 'Lead', items: ['🧱 Set the sprint WIP cap before planning starts.', '🗓️ Schedule protected design review blocks for the next sprint.'] },
      { attendee: 'Engineer', items: ['⏱️ Track review queue wait time during the sprint.', '🚩 Flag any PR that sits blocked long enough to threaten delivery.'] },
      { attendee: 'Designer', items: ['🤝 Identify upcoming stories that need early pairing.', '✅ Join review blocks with clear UX acceptance criteria for complex flows.'] }
    ]
  }))
];

const knowledge = [
  knowledgeItem('demo-knowledge-resume', 'Resume - Alex Morgan.md', 'upload', 'Staff engineer with 9 years building React, Node, and data-heavy workflow products. Led design system adoption across 14 product teams and reduced dashboard interaction latency by 43%.', { source: 'upload' }, -35),
  knowledgeItem('demo-knowledge-orion-jd', 'Orion Labs Staff Frontend JD.md', 'upload', 'Orion Labs needs a Staff Frontend Engineer to lead collaborative analytics surfaces, design system architecture, accessibility quality, and frontend observability.', { source: 'upload', mode: 'interview', entityId: 'demo-orion-labs', entityName: 'Orion Labs' }, -22),
  knowledgeItem('demo-knowledge-nova-notes', 'Nova Health Interview Prep.md', 'upload', 'Nova Health focuses on care-team task coordination, HIPAA-sensitive workflows, patient data quality, and measurable operational outcomes for clinical users.', { source: 'upload', mode: 'interview', entityId: 'demo-nova-health', entityName: 'Nova Health' }, -11),
  knowledgeItem('demo-knowledge-product-memory', 'Product Weekly Memory.md', 'upload', 'Recurring product themes: keep onboarding simple, avoid analytics drift, require launch guardrails, and tie experiments to activation quality.', { source: 'upload', mode: 'meeting', entityId: 'demo-product-weekly', entityName: 'Product Weekly' }, -6),
  ...sessions.slice(0, 5).map((record) => knowledgeItem(
    `session:${record.mode}:${record.entity.id}:${record.id}`,
    `${record.entity.name} - ${record.title}.txt`,
    'transcript',
    record.transcript.map((turn) => `${turn.speaker}: ${turn.text}`).join('\n'),
    { source: 'session', sessionId: record.id, mode: record.mode, entityId: record.entity.id, entityName: record.entity.name, title: record.title, date: record.date },
    -4
  ))
];

const calendarEvents = [
  event('demo-cal-orion-final', 'Orion Labs final loop', 2, 'interview', 'demo-orion-labs', 'Orion Labs', '#00e5ff'),
  event('demo-cal-nova-onsite', 'Nova Health onsite panel', 5, 'interview', 'demo-nova-health', 'Nova Health', '#00e5ff'),
  event('demo-cal-product-weekly', 'Product Weekly', 1, 'meeting', 'demo-product-weekly', 'Product Weekly', '#00ffaa'),
  event('demo-cal-investor', 'Investor update rehearsal', 7, 'meeting', 'demo-investor-update', 'Investor Update', '#00ffaa'),
  event('demo-cal-followup', 'Send Apex offer follow-up', -1, 'interview', 'demo-apex-fintech', 'Apex Fintech', '#ffaa00')
];

const mockInterviews = [
  {
    id: 'demo-mock-orion-system-design',
    opportunity: entities.interview[0],
    title: 'Mock System Design: Collaborative Dashboard',
    date: daysFromNow(-6, 18),
    transcript: sessions[1].transcript,
    assessment: {
      overallScore: 87,
      verdict: 'Final-loop ready',
      executiveSummary: 'You gave a strong Staff-level system design answer with crisp state separation, practical scaling tradeoffs, and a clear sense of how to make realtime collaboration observable in production.',
      summary: 'Strong structure and senior-level tradeoff language. Add one deeper failure-mode discussion before final loop.',
      categories: [
        { name: 'Architecture', score: 92, rationale: 'You separated presence, document state, mutation ordering, and optimistic UI without overcomplicating the design.' },
        { name: 'Communication', score: 84, rationale: 'The explanation was clear and structured, though you should ask clarifying questions before proposing the architecture.' },
        { name: 'Product judgment', score: 86, rationale: 'You connected performance and reliability decisions to user trust and collaboration quality.' },
        { name: 'Production readiness', score: 88, rationale: 'You named concrete monitoring surfaces for latency, fanout, and render cost.' }
      ],
      strengths: ['Separated state domains clearly', 'Used measurable performance targets', 'Explained rollout risk well'],
      risks: ['Clarifying questions came after the first design pass', 'Offline and conflict-resolution behavior needs one more concrete example', 'Data retention assumptions were implicit rather than stated'],
      actionPlan: ['Open with 3 clarifying questions about collaboration semantics, scale, and offline expectations.', 'Add a failure-mode section covering replay, duplicate events, and reconnect behavior.', 'Close by summarizing launch metrics and rollback plan.'],
      answerReviews: [
        { question: 'Design a collaborative dashboard that updates in real time for thousands of users.', score: 90, feedback: 'Strong answer. You framed the architecture around state boundaries and production metrics, which is exactly the level expected for Staff.', betterAnswer: 'I would first clarify whether collaboration is document editing, presence, or shared analytics state. Then I would split presence from durable document mutations, use server-authored sequence IDs, and let the client render optimistically while reconciling conflicts through a small, observable state machine.' },
        { question: 'How would you keep it fast?', score: 86, feedback: 'Good focus on virtualization and subscription partitioning. Make the answer stronger by naming target metrics and degradation strategies.', betterAnswer: 'I would set targets for input latency, event-to-render latency, and long tasks. Then I would partition subscriptions by dashboard region, virtualize expensive panels, use backpressure for bursty updates, and degrade non-critical widgets before the core collaborative surface slows down.' }
      ],
      nextPracticePrompt: 'Run a 10-minute follow-up drill on realtime failure modes: reconnects, duplicate events, event ordering, and offline edits.'
    }
  },
  {
    id: 'demo-mock-nova-behavioral',
    opportunity: entities.interview[1],
    title: 'Mock Behavioral: Incident Ownership',
    date: daysFromNow(-2, 19),
    transcript: sessions[3].transcript,
    assessment: {
      overallScore: 73,
      verdict: 'Promising but needs domain depth',
      executiveSummary: 'You showed ownership and a usable STAR structure, but the answer needs more healthcare specificity and sharper metrics before a senior full-stack panel.',
      summary: 'Good STAR structure. Add healthcare-specific impact and clearer team coordination details.',
      categories: [
        { name: 'Specificity', score: 70, rationale: 'The incident was understandable, but the before/after metrics were light.' },
        { name: 'Ownership', score: 82, rationale: 'You clearly owned rollback, root cause, and test coverage.' },
        { name: 'Domain relevance', score: 63, rationale: 'You did not yet connect the work to clinical workflows, auditability, or patient safety.' },
        { name: 'Communication', score: 76, rationale: 'The answer was organized, but could be tighter and more outcome-driven.' }
      ],
      strengths: ['Clear ownership', 'Good postmortem framing'],
      risks: ['Healthcare context was generic', 'Impact metrics were not quantified enough', 'Team coordination details were compressed'],
      actionPlan: ['Prepare one healthcare-adjacent story using operational metrics and risk controls.', 'Name the users affected, the workflow impact, and the safety or compliance implication.', 'End each answer with the measurable result and what changed permanently.'],
      answerReviews: [
        { question: 'Tell me about a hard production issue.', score: 74, feedback: 'Good ownership arc. Add the magnitude of the failure, who was affected, and what changed after the postmortem.', betterAnswer: 'A checkout release degraded conversion by 8% because a feature-flag path bypassed caching. I led rollback, isolated the flag matrix gap, and added synthetic coverage so every flag state hit the same cache contract before release.' },
        { question: 'Where do you want to grow?', score: 71, feedback: 'The growth area is credible, but make it useful to Nova by tying it to their care-team workflows.', betterAnswer: 'I want to grow in healthcare workflow design: how clinical teams prioritize tasks, how audit trails shape UX, and how engineering choices can reduce cognitive load without compromising compliance.' }
      ],
      nextPracticePrompt: 'Practice a Nova-specific behavioral answer about a reliability issue affecting care-team operations, including user impact, controls, and measurable recovery.'
    }
  }
];

const syncProposals = [
  {
    id: 'demo-sync-proposal-orion-final',
    type: 'calendar-event',
    status: 'pending',
    title: 'Add Orion Labs final loop',
    summary: 'Detected final-loop invite from recruiter and matched it to Orion Labs.',
    createdAt: daysFromNow(-1, 13),
    payload: calendarEvents[0]
  },
  {
    id: 'demo-sync-proposal-nova-note',
    type: 'knowledge',
    status: 'pending',
    title: 'Import Nova prep email',
    summary: 'Found recruiter email with panel topics: care coordination, audit trails, and pagination exercise.',
    createdAt: daysFromNow(-1, 14)
  }
];

const syncAudit = [
  { id: 'demo-audit-1', type: 'google-scan', status: 'success', message: 'Scanned Gmail and Calendar for interview signals.', createdAt: daysFromNow(-1, 12), read: false },
  { id: 'demo-audit-2', type: 'proposal-created', status: 'pending', message: 'Created 2 sync proposals from recent Google activity.', createdAt: daysFromNow(-1, 13), read: false },
  { id: 'demo-audit-3', type: 'calendar-import', status: 'success', message: 'Imported Apex offer follow-up event.', createdAt: daysFromNow(-9, 9), read: true }
];

function isDemoMode(settings = {}) {
  return Boolean(settings.demoMode || process.env.CLYDE_DEMO_MODE === '1');
}

function demoSettings(settings = {}) {
  return {
    ...settings,
    demoMode: true,
    userTier: 'pro',
    proAgentEnabled: true,
    googleSyncEnabled: true,
    googleAccountEmail: settings.googleAccountEmail || 'alex.demo@example.com',
    currentCompany: settings.currentCompany || 'demo-orion-labs',
    currentRole: settings.currentRole || 'Staff Frontend Engineer',
    meetingTitle: settings.meetingTitle || 'Product Weekly',
    meetingAttendees: Array.isArray(settings.meetingAttendees) && settings.meetingAttendees.length
      ? settings.meetingAttendees
      : ['Maya Chen', 'Jordan Lee', 'Priya Shah'],
    resumeText: settings.resumeText || knowledge[0].content,
    pinnedKnowledgeIds: settings.pinnedKnowledgeIds?.length ? settings.pinnedKnowledgeIds : ['demo-knowledge-resume', 'demo-knowledge-orion-jd']
  };
}

function getSessionEntities(mode = 'interview') {
  return [...(entities[normalizeMode(mode)] || [])];
}

function getSessions(filters = {}) {
  const mode = normalizeMode(filters.mode);
  return sessions
    .filter((record) => record.mode === mode)
    .filter((record) => !filters.entityId || record.entity.id === filters.entityId)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function listKnowledge(filters = {}) {
  const query = String(filters.query || '').toLowerCase();
  return knowledge
    .filter((item) => !filters.type || item.type === filters.type)
    .filter((item) => !filters.mode || item.metadata?.mode === filters.mode)
    .filter((item) => !filters.entityId || item.metadata?.entityId === filters.entityId)
    .filter((item) => !query || `${item.filename} ${item.content}`.toLowerCase().includes(query))
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
}

function listAgentSources(filters = {}) {
  const sourceSessions = getSessions(filters).slice(0, 8).map((record) => ({
    id: record.id,
    type: 'session',
    title: `${record.entity.name}: ${record.title}`,
    subtitle: record.entity.role || record.summary,
    content: record.transcript.map((turn) => `${turn.speaker}: ${turn.text}`).join('\n'),
    metadata: { mode: record.mode, entityId: record.entity.id, date: record.date }
  }));
  const sourceKnowledge = listKnowledge(filters).slice(0, 8).map((item) => ({
    id: item.id,
    type: 'knowledge',
    title: item.filename,
    subtitle: item.type,
    content: item.content,
    metadata: item.metadata
  }));
  return [...sourceSessions, ...sourceKnowledge];
}

function getTrendAnalysis(companyId) {
  const records = getSessions({ mode: 'interview', entityId: companyId }).reverse();
  if (records.length < 2) return null;
  return {
    sessionsCount: records.length,
    sessionsSignature: records.map((record) => `${record.id}:${record.date}`).join('|'),
    analysis: buildTrend(records)
  };
}

function generateTrendAnalysis(companyId) {
  const record = getTrendAnalysis(companyId);
  return record?.analysis || null;
}

function getOutcomeCalibrationSummary() {
  return { total: 4, rejected: 1, advanced: 1, offer: 1, active: 1, positive: 2 };
}

function getGoogleSyncStatus() {
  return {
    connected: true,
    accountEmail: 'alex.demo@example.com',
    enabled: true,
    pendingCount: syncProposals.length,
    lastScanAt: daysFromNow(-1, 12)
  };
}

function listSyncProposals(filters = {}) {
  return syncProposals.filter((proposal) => !filters.status || proposal.status === filters.status);
}

function listSyncAudit(limit = 100) {
  return syncAudit.slice(0, Number(limit) || 100);
}

function buildTrend(records) {
  const latest = records[records.length - 1];
  const isOrion = latest.entity.id === 'demo-orion-labs';
  return {
    trend: latest.entity.trend === 'down' ? 'down' : latest.entity.trend === 'sideways' ? 'sideways' : 'up',
    executive_summary: isOrion
      ? 'Orion Labs shows clear upward momentum across recruiter, technical, and product-sense rounds. Your strongest signal is Staff-level frontend judgment: you connect architecture, observability, accessibility, and product sequencing without sounding theoretical. The final loop should be treated as a calibration round on influence, failure modes, and executive communication.'
      : `${latest.entity.name} shows ${latest.entity.trend || 'positive'} interview momentum across ${records.length} recorded touchpoints. The strongest signal is clear senior-level reasoning backed by concrete execution examples.`,
    key_strengths: isOrion
      ? ['You explain frontend architecture as a system of user experience, data flow, and operational feedback loops.', 'You consistently translate technical decisions into business and product risk language.', 'Your answers show credible cross-functional influence with design, API, QA, and product partners.']
      : ['Structured answers with crisp tradeoffs', 'Strong product and operational judgment', 'Clear examples from real delivery work'],
    areas_for_improvement: isOrion
      ? ['Ask clarifying questions before solutioning so the interviewer sees your framing process.', 'Add explicit failure-mode coverage: reconnects, duplicate events, rollback, and degraded UX.', 'Quantify leadership impact earlier, especially adoption, latency, accessibility, or release-quality metrics.']
      : ['Ask clarifying questions before solving', 'Quantify impact earlier in behavioral answers', 'Prepare deeper domain-specific examples'],
    phase_breakdown: records.map((record, index) => ({
      phase: record.title,
      date: record.date,
      score: record.grading?.score || 0,
      summary: record.summary,
      observation: phaseObservation(record, index),
      trend: index === 0 ? 'baseline' : ((record.grading?.score || 0) >= (records[index - 1].grading?.score || 0) ? 'up' : 'down')
    })),
    pre_call_prep: {
      cumulative_phase_summary: isOrion
        ? ['You progressed from solid role alignment in the recruiter screen to a much stronger technical signal in system design, then reinforced the trend with product judgment.', 'The strongest through-line is that you do not treat frontend as screens only; you frame it as performance, accessibility, observability, and team leverage.', 'Your final-loop narrative should be: I build reliable product surfaces, raise engineering quality, and align teams around measurable user outcomes.']
        : ['Lead with the platform-scale frontend narrative.', 'Reference measurable latency and accessibility outcomes.', 'Connect collaboration patterns to Staff-level influence.'],
      probable_focus: isOrion
        ? ['Staff-level influence: how you set technical direction across teams without becoming a bottleneck.', 'Realtime UI failure modes: reconnect behavior, stale data, duplicate events, offline edits, and graceful degradation.', 'Product partnership: when to push for platform investment versus when to ship incremental customer value.']
        : ['Final-loop architecture tradeoffs', 'Cross-functional influence without direct authority', 'How you mentor teams through ambiguous requirements'],
      interviewer_question_patterns: isOrion
        ? ['They ask broad design questions, then probe for operational specifics like latency, fanout, and release safety.', 'They value product judgment questions that force you to compare rebuilds, migrations, and incremental quality improvements.', 'They respond well when you cite concrete team rituals: launch checklists, design-system adoption, QA partnership, and metrics reviews.']
        : ['Design a scalable UI workflow', 'Explain production failure recovery', 'Show product judgment under constraints'],
      questions_to_ask: isOrion
        ? ['What frontend reliability or collaboration problems are currently limiting Orion Labs customers?', 'How do Staff engineers influence roadmap sequencing across product, design, and platform teams?', 'What would a highly successful first six months look like for this role beyond shipping features?']
        : ['What would make the next hire successful in the first quarter?', 'Which product constraints matter most for this team right now?', 'Where does the team need more technical leadership?']
    }
  };
}

function session(id, mode, entity, title, days, rating, turns, score, summary) {
  const notes = summary && typeof summary === 'object'
    ? { summary: summary.summary || '', actionItems: Array.isArray(summary.actionItems) ? summary.actionItems : [] }
    : { summary };
  const summaryText = notes.summary;

  return {
    id,
    mode,
    title,
    phase: title,
    date: daysFromNow(days),
    entity: { ...entity },
    transcript: turns.map(([speaker, text]) => ({ speaker, text })),
    transcriptRating: rating,
    rating,
    summary: summaryText,
    notes,
    grading: score ? {
      status: 'complete',
      score,
      transcriptScore: rating * 20,
      transcriptRating: rating,
      grade: score >= 90 ? 'A-' : score >= 85 ? 'B+' : score >= 80 ? 'B' : score >= 70 ? 'C+' : score >= 60 ? 'D' : 'F',
      summary: summaryText,
      examples: ['Clear structure', 'Specific examples'],
      strengths: ['Clear structure', 'Specific examples'],
      improvements: ['Add more quantified impact']
    } : null
  };
}

function meetingNotes({ overview, sections = {}, actionItems = [] }) {
  const sectionText = Object.entries(sections)
    .map(([title, body]) => `**${title}:** ${body}`)
    .join(' ');

  return {
    summary: [overview, sectionText].filter(Boolean).join(' '),
    actionItems
  };
}

function sections({ overall, evidence, risks, outlook }) {
  return [
    `**Overall assessment:** ${overall}`,
    `**Evidence:** ${evidence}`,
    `**Risks:** ${risks}`,
    `**Outlook:** ${outlook}`
  ].join(' ');
}

function phaseObservation(record, index) {
  if (record.entity.id === 'demo-orion-labs') {
    return [
      'You established role fit and seniority, but the answer was still mostly positioning. The next step was proving depth with specific technical tradeoffs.',
      'You materially improved the signal by separating realtime state domains, naming observability metrics, and explaining how performance would be protected at scale.',
      'You converted the technical signal into product leadership signal by explaining how to sequence quality work, migration risk, and cross-functional alignment.'
    ][index] || record.summary;
  }

  return record.summary;
}

function knowledgeItem(id, filename, type, content, metadata, days) {
  const updated = daysFromNow(days);
  return {
    id,
    filename,
    file_path: '',
    content,
    type,
    metadata,
    metadata_json: JSON.stringify(metadata || {}),
    created_at: updated,
    updated_at: updated
  };
}

function event(id, title, days, mode, entityId, entityName, color) {
  return {
    id,
    title,
    date: daysFromNow(days),
    associationMode: mode,
    entityId,
    entityName,
    color,
    source: 'demo',
    createdAt: daysFromNow(days - 7),
    updatedAt: daysFromNow(days - 1)
  };
}

function normalizeMode(mode) {
  return mode === 'meeting' ? 'meeting' : 'interview';
}

module.exports = {
  demoSettings,
  generateTrendAnalysis,
  getGoogleSyncStatus,
  getOutcomeCalibrationSummary,
  getSessionEntities,
  getSessions,
  getTrendAnalysis,
  isDemoMode,
  listAgentSources,
  listCalendarEvents: () => [...calendarEvents].sort((a, b) => new Date(a.date) - new Date(b.date)),
  listKnowledge,
  listMockInterviews: () => [...mockInterviews],
  listSyncAudit,
  listSyncProposals
};
