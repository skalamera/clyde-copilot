/**
 * extensionServer.js — Local HTTP API server for Jayobee ↔ Clyde integration.
 *
 * Listens on port 4593 and provides REST endpoints that the
 * Jayobee Chrome Extension uses to send job descriptions, sync
 * to the Cockpit, and query active session state.
 *
 * The server is started after managers are initialized in main.js
 * and stopped gracefully on app quit.
 *
 * Endpoints (all prefixed with /api/):
 *   GET  /api/status              — Health check
 *   GET  /api/settings            — Get user profile settings (safe subset)
 *   POST /api/settings            — Update settings, emits IPC event
 *   POST /api/jobs                — Register a clipped job description
 *   POST /api/documents           — Save tailored resume/cover letter/STAR+R
 *   POST /api/cockpit/active      — Set active interview context
 */

const http = require('node:http');
const { URL } = require('node:url');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PORT = 4593;
let server = null;
let managers = null;
let mainWindowRef = null;
let lastExtensionSyncTime = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    request.on('error', reject);
  });
}

/**
 * Origin guard for the local API.
 *
 * The server binds to 127.0.0.1, but web pages running in a local browser can
 * still fire fetch()/XHR at localhost ports (drive-by localhost attacks).
 * Policy:
 *   - Requests with NO Origin header are allowed (extension service-worker
 *     fetches, curl, local tooling, the Clyde app itself).
 *   - Requests with a chrome-extension:// / moz-extension:// origin are allowed.
 *   - Requests with an http(s):// origin (i.e. coming from a web page) are
 *     REJECTED — no website should ever talk to this API directly.
 */
function isOriginAllowed(request) {
  const origin = String(request.headers.origin || '').trim().toLowerCase();
  if (!origin || origin === 'null') {
    return true;
  }
  return origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://');
}

function corsHeadersFor(request) {
  const origin = String(request.headers.origin || '').trim();
  return {
    // Echo only trusted extension origins; web origins never get CORS approval.
    'Access-Control-Allow-Origin': isOriginAllowed(request) && origin ? origin : 'null',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin'
  };
}

function jsonResponse(response, statusCode, data) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    ...(response.clydeCorsHeaders || {
      'Access-Control-Allow-Origin': 'null',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    })
  });
  response.end(JSON.stringify(data));
}

function urlParts(request) {
  const parsed = new URL(request.url, `http://localhost:${PORT}`);
  return {
    pathname: parsed.pathname.replace(/\/+$/, '') || '/',
    searchParams: parsed.searchParams
  };
}

function entityIdFromName(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/**
 * GET /api/status
 * Health check.
 */
function handleStatus(_request, response) {
  jsonResponse(response, 200, {
    status: 'ok',
    version: '1.0.0-beta.2'
  });
}

/**
 * GET /api/settings
 * Returns user's profile settings (safe subset — no tokens).
 */
function handleGetSettings(_request, response) {
  const { loadSettings, publicSettings } = managers;
  const settings = loadSettings();
  jsonResponse(response, 200, {
    status: 'ok',
    settings: publicSettings(settings)
  });
}

/**
 * POST /api/settings
 * Updates Clyde's settings with new values and sends an IPC
 * 'settings-changed' event to the renderer so the UI refreshes.
 *
 * Body: partial settings object, e.g. { resumeText, jobDescription, currentCompany }
 */
async function handleUpdateSettings(request, response) {
  const { loadSettings, saveSettings } = managers;
  try {
    const body = await parseBody(request);
    const current = loadSettings();
    const updated = { ...current, ...body };
    saveSettings(updated);

    // Notify the renderer so the UI can refresh
    trySendIpc('settings-changed', updated);

    jsonResponse(response, 200, { status: 'ok' });
  } catch (err) {
    jsonResponse(response, 400, { status: 'error', error: err.message });
  }
}

/**
 * POST /api/jobs
 * Registers a clipped job description. Calls
 * sessionManager.updateEntity('interview', entityId, { name, role, outcome })
 * and saves a placeholder session to register it in Clyde's visual tracker.
 *
 * Body: { company: string, role?: string, jdText: string }
 */
async function handleCreateJob(request, response) {
  const { interviewManager, sessionManager, knowledgeManager, loadSettings, saveSettings } = managers;
  try {
    const body = await parseBody(request);
    const company = (body.company || '').trim();
    const role = (body.role || '').trim();
    const jdText = (body.jdText || '').trim();

    if (!company || !jdText) {
      return jsonResponse(response, 400, {
        status: 'error',
        error: 'company and jdText are required'
      });
    }

    const entityId = entityIdFromName(company);

    // 1. Store JD text via interviewManager
    interviewManager.setCompanyJobDescription(company, jdText);
    if (role) {
      interviewManager.setCompanyRole(company, role);
    }

    // 2. Register entity in session system for visual tracker
    const matchScore = body.matchScore !== undefined ? body.matchScore : (body.rating !== undefined ? body.rating : (body.match_score !== undefined ? body.match_score : undefined));
    const topStrength = body.topStrength || body.top_strength || '';
    const mainGap = body.mainGap || body.main_gap || '';
    const mitigation = body.mitigation || body.mitigation || '';

    sessionManager.updateEntity('interview', entityId, {
      name: company,
      role: role || '',
      kind: 'interview',
      outcome: 'applied',
      match_score: matchScore,
      top_strength: topStrength,
      main_gap: mainGap,
      mitigation: mitigation
    });

    // 4. Save placeholder session so it shows in Clyde's tracker
    try {
      sessionManager.saveSession({
        mode: 'interview',
        entity: {
          id: entityId,
          name: company,
          role: role || ''
        },
        startTime: new Date().toISOString()
      });
    } catch (_) {
      // session may already exist — that's fine
    }

    // 5. Store as a knowledge document
    let knowledgeId = null;
    try {
      const jdItemId = `jd-${entityId}`;
      const docContent = `# Job Description: ${company}${role ? ` - ${role}` : ''}\n\n${jdText}`;
      knowledgeManager.upsertKnowledgeItem({
        id: jdItemId,
        filename: `${company}${role ? ` - ${role}` : ''} - Job Description.md`,
        content: docContent,
        type: 'jd',
        metadata: {
          source: 'jayobee-extension',
          company,
          role,
          mode: 'interview',
          entityId
        }
      });
      knowledgeId = jdItemId;
    } catch (kmError) {
      console.error('[extensionServer] Failed to store JD in knowledge base:', kmError.message);
    }

    // Notify renderer
    trySendIpc('session-data-changed', { entityId, company, role, action: 'job-created' });

    return jsonResponse(response, 200, {
      status: 'ok',
      company,
      role,
      entityId,
      knowledgeId,
      stored: true
    });
  } catch (err) {
    return jsonResponse(response, 500, { status: 'error', error: err.message });
  }
}

/**
 * POST /api/documents
 * Saves tailored resumes, cover letters, or STAR+R sheets into
 * Clyde's knowledge_base so they are available for real-time interview assistance.
 *
 * Body: { company: string, role?: string, filename: string, content: string, type: string }
 *   type can be: 'resume', 'cover-letter', 'star-r', 'question-bank'
 */
async function handleCreateDocument(request, response) {
  const { knowledgeManager, loadSettings, saveSettings } = managers;
  try {
    const body = await parseBody(request);
    const company = (body.company || '').trim();
    const role = (body.role || '').trim();
    const filename = (body.filename || '').trim();
    const content = (body.content || '').trim();
    const docType = (body.type || 'other').trim();

    if (!company || !content) {
      return jsonResponse(response, 400, {
        status: 'error',
        error: 'company and content are required'
      });
    }

    const entityId = entityIdFromName(company);
    const safeFilename = filename || `${company}${role ? ` - ${role}` : ''} - ${docType}.md`;
    const itemId = `doc-${entityId}-${docType}-${Date.now()}`;

    // Save into knowledge_base
    try {
      knowledgeManager.upsertKnowledgeItem({
        id: itemId,
        filename: safeFilename,
        content,
        type: docType,
        metadata: {
          source: 'jayobee-extension',
          company,
          role,
          entityId,
          mode: 'interview',
          documentType: docType
        }
      });
    } catch (kmError) {
      console.error('[extensionServer] Failed to store document:', kmError.message);
      return jsonResponse(response, 500, {
        status: 'error',
        error: 'Failed to store document: ' + kmError.message
      });
    }

    // Notify renderer
    trySendIpc('session-data-changed', { entityId, company, role, docType, itemId, action: 'document-saved' });

    return jsonResponse(response, 200, {
      status: 'ok',
      documentId: itemId,
      company,
      role,
      type: docType,
      stored: true
    });
  } catch (err) {
    return jsonResponse(response, 500, { status: 'error', error: err.message });
  }
}

/**
 * POST /api/cockpit/active
 * Accepts { jobDescription, companyName, roleName } and instantly updates
 * Clyde's active interview / cockpit view. Sends an IPC event to the main
 * window to open the active capture window or focus prep mode.
 *
 * Body: { jobDescription: string, companyName: string, roleName?: string }
 */
async function handleSetActiveCockpit(request, response) {
  const { interviewManager, sessionManager, knowledgeManager, loadSettings, saveSettings } = managers;
  try {
    const body = await parseBody(request);
    const jobDescription = (body.jobDescription || '').trim();
    const companyName = (body.companyName || '').trim();
    const roleName = (body.roleName || '').trim();

    if (!companyName || !jobDescription) {
      return jsonResponse(response, 400, {
        status: 'error',
        error: 'companyName and jobDescription are required'
      });
    }

    const entityId = entityIdFromName(companyName);

    // 1. Store the JD text
    interviewManager.setCompanyJobDescription(companyName, jobDescription);
    if (roleName) {
      interviewManager.setCompanyRole(companyName, roleName);
    }

    // 2. Update active company/role in settings
    const currentSettings = loadSettings();
    saveSettings({
      ...currentSettings,
      currentCompany: companyName,
      currentRole: roleName || currentSettings.currentRole,
      jobDescription
    });

    // 3. Register/update in session system
    sessionManager.updateEntity('interview', entityId, {
      name: companyName,
      role: roleName || '',
      kind: 'interview',
      outcome: 'applied',
      confidence: 1.0
    });

    // 4. Save in knowledge base
    try {
      const itemId = `cockpit-${entityId}`;
      const docContent = `# Active Cockpit: ${companyName}${roleName ? ` - ${roleName}` : ''}\n\n${jobDescription}`;
      knowledgeManager.upsertKnowledgeItem({
        id: itemId,
        filename: `${companyName}${roleName ? ` - ${roleName}` : ''} - Active Cockpit.md`,
        content: docContent,
        type: 'cockpit',
        metadata: {
          source: 'jayobee-extension',
          company: companyName,
          role: roleName,
          mode: 'interview',
          entityId,
          active: true
        }
      });
    } catch (kmError) {
      console.error('[extensionServer] Failed to store active cockpit JD:', kmError.message);
    }

    // 5. Send IPC event to renderer — triggers cockpit/prep mode switch
    trySendIpc('cockpit-active', {
      company: companyName,
      role: roleName,
      entityId,
      jobDescription,
      action: 'activate'
    });

    return jsonResponse(response, 200, {
      status: 'ok',
      company: companyName,
      role: roleName,
      entityId,
      cockpitActivated: true
    });
  } catch (err) {
    return jsonResponse(response, 500, { status: 'error', error: err.message });
  }
}

// ---------------------------------------------------------------------------
// IPC helper
// ---------------------------------------------------------------------------

function trySendIpc(channel, data) {
  try {
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.webContents.send(channel, data);
    }
  } catch (_) {
    // window may not be ready yet — that's okay
  }
}

// ---------------------------------------------------------------------------
// Route dispatcher
// ---------------------------------------------------------------------------

const ROUTES = new Map([
  ['GET /api/status', handleStatus],
  ['GET /api/settings', handleGetSettings],
  ['POST /api/settings', handleUpdateSettings],
  ['POST /api/jobs', handleCreateJob],
  ['POST /api/documents', handleCreateDocument],
  ['POST /api/cockpit/active', handleSetActiveCockpit]
]);

async function dispatch(request, response) {
  lastExtensionSyncTime = new Date().toISOString();
  const { pathname } = urlParts(request);
  const method = request.method.toUpperCase();

  // 1. Validate Host header strictly to prevent DNS rebinding attacks.
  const host = String(request.headers.host || '').trim().toLowerCase();
  const serverPort = server?.address()?.port || PORT;
  const allowedHosts = [`127.0.0.1:${serverPort}`, `localhost:${serverPort}`];
  if (!allowedHosts.includes(host)) {
    return jsonResponse(response, 400, {
      status: 'error',
      error: 'Bad Request: Invalid Host header'
    });
  }

  // Attach computed CORS headers for this request so jsonResponse can use them.
  response.clydeCorsHeaders = corsHeadersFor(request);

  // Block requests originating from web pages (drive-by localhost attacks).
  if (!isOriginAllowed(request)) {
    return jsonResponse(response, 403, {
      status: 'error',
      error: 'Forbidden: web page origins are not allowed to access the Clyde local API.'
    });
  }

  // CORS preflight
  if (method === 'OPTIONS') {
    response.writeHead(204, {
      ...response.clydeCorsHeaders,
      'Access-Control-Max-Age': '86400'
    });
    return response.end();
  }

  // 2. Validate Extension Pairing Token for all endpoints except safe health check.
  if (pathname !== '/api/status') {
    const authHeader = String(request.headers.authorization || '').trim();
    const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
    const storedToken = managers?.loadSettings()?.extensionPairingToken;
    if (!storedToken || token !== storedToken) {
      return jsonResponse(response, 401, {
        status: 'error',
        error: 'Unauthorized: Invalid extension pairing token.'
      });
    }
  }

  // Exact route match
  const handler = ROUTES.get(`${method} ${pathname}`);
  if (handler) {
    return handler(request, response);
  }

  // 404
  jsonResponse(response, 404, { status: 'error', error: 'Not found', pathname });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start the extension API server.
 *
 * @param {object} managerRefs     — references to Clyde's managers and helpers
 * @param {object} mainWindow      — Electron BrowserWindow reference for IPC
 * @param {object} [options]
 * @param {number} [options.port=4593]
 * @returns {Promise<void>}
 */
async function startExtensionServer(managerRefs, win, options = {}) {
  if (server) {
    console.log('[extensionServer] Server is already running.');
    return;
  }

  managers = managerRefs;
  mainWindowRef = win;
  const port = options.port || PORT;

  return new Promise((resolve, reject) => {
    server = http.createServer(dispatch);

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[extensionServer] Port ${port} is already in use. Extension integration may be unavailable.`);
        server = null;
        resolve();
      } else {
        console.error('[extensionServer] Fatal error:', err.message);
        reject(err);
      }
    });

    server.listen(port, '127.0.0.1', () => {
      console.log(`[extensionServer] Listening on http://127.0.0.1:${port}`);
      resolve();
    });
  });
}

/**
 * Stop the extension API server gracefully.
 */
function stopExtensionServer() {
  if (!server) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    server.close(() => {
      console.log('[extensionServer] Stopped.');
      server = null;
      managers = null;
      mainWindowRef = null;
      resolve();
    });
  });
}

/**
 * Returns whether the server is currently listening.
 */
function isExtensionServerRunning() {
  return server !== null;
}

function getLastExtensionSyncTime() {
  return lastExtensionSyncTime;
}

module.exports = {
  startExtensionServer,
  stopExtensionServer,
  isExtensionServerRunning,
  getLastExtensionSyncTime
};
