# Clyde + Clyde Go Improvement Plan (June 2026 Review)

> **For Hermes:** Use subagent-driven-development to implement task-by-task once Stephen approves. DO NOT IMPLEMENT until approved.

**Goal:** Close security/auth gaps found in the June 2026 deep review of both repos, then ship the highest-value reliability and feature improvements.

**Repos:**
- Desktop: `C:/Users/skala/OneDrive/Documents/Projects/clyde` (Electron, main.js 4,349 lines, website/api on Vercel)
- Extension: `C:/Users/skala/OneDrive/Documents/Projects/clyde-go` (MV3, ~9,800 LOC, no build step)

**Note:** clyde-go has ~10 uncommitted modified files. Commit or stash before starting any work.

---

# PHASE 1 — CRITICAL SECURITY (do first, mostly server-side, no client release needed)

### Task 1.1: Lock down the Google OAuth token-exchange proxy
**Severity: HIGH** — `website/api/google-oauth-token.js` is an unauthenticated proxy that exchanges auth codes AND refresh tokens using Clyde's Google client secret. Anyone can ride Clyde's verified OAuth client identity (phishing enabler + quota abuse).
**Files:** Modify `website/api/google-oauth-token.js`
**Fix:**
1. Require the same auth gate as `proxy.js` (Supabase JWT or signed `clyde_lic_` license token) before exchanging anything.
2. Replace free-form `body.redirectUri` with an allowlist: `http://127.0.0.1:<port>` / `http://localhost:<port>` loopback (any port, validated via URL parse) + `https://clydeai.live/*`. Reject everything else with 400.
3. Add the in-memory `checkRateLimit` pattern from proxy.js.
**Verify:** curl without token → 401; with valid token + loopback redirect → works; with `https://evil.com` redirect → 400.

### Task 1.2: Stop logging user content in the Vercel proxy
**Severity: HIGH (privacy/GDPR)** — `website/api/proxy.js:246, 394, 462` logs full raw model responses (interview transcripts, resume content) to Vercel logs on every Pro request.
**Files:** Modify `website/api/proxy.js`
**Fix:** Replace `console.log("…Raw response:", rawText)` with `console.log("…response", { status, bytes: rawText.length })`. Log bodies only when `status >= 400`, truncated to 300 chars (error paths already do this — make success paths match).
**Verify:** grep proxy.js for `RawText`/`Raw response` → only in error branches, truncated.

### Task 1.3: Add auth to the desktop ↔ extension localhost API (pairing token)
**Severity: HIGH** — Extension talks to `http://127.0.0.1:4593/api/*` with zero auth. Any local process — or web pages via localhost CSRF/DNS rebinding — can inject jobs/documents or mutate desktop settings via POST /settings.
**Files:** Modify desktop server module (search `4593` in clyde repo — likely main.js or src/), `clyde-go/lib/clyde-client.js`, `clyde-go/options.js` (token entry UI), `clyde-go/manifest.json` (add `http://127.0.0.1:4593/*` to host_permissions if CORS is tightened)
**Fix:**
1. Desktop: generate a pairing token once (crypto.randomUUID), persist in electron-store, display it in the desktop Settings UI ("Extension pairing code") with copy button.
2. Desktop server middleware: reject requests missing `Authorization: Bearer <token>`; also validate `Host` header is `127.0.0.1:4593` (kills DNS rebinding).
3. Extension: token field in options.js, stored in chrome.storage; clyde-client.js sends it on every request; surface a "pairing required" state in the sync UI when 401.
**Verify:** curl without token → 401; extension with token syncs; request with `Host: evil.com` → 403.

### Task 1.4: Escape all dynamic HTML in clyde-go (XSS via prompt-injected job postings)
**Severity: HIGH** — A malicious job posting can prompt-inject Gemini and get attacker markup rendered in the extension-privileged popup. `popup.js createClipElement()` (~478–556) interpolates raw Gemini output (`topStrength`, `mainGap`, `mitigation`, `archetype`, `salary`) and partially-escaped title/company into innerHTML. Also `content.js:710 showError(message)` and `background.js:666` modal (`highlightedQuestion`).
**Files:** Create `clyde-go/lib/escape.js`; modify `popup.js`, `content.js`, `background.js`, `options.js`, `manifest.json` (add lib/escape.js to content_scripts + importScripts)
**Fix:**
1. Promote the existing `escapeHtml()` from options.js:617 into `lib/escape.js` (escape `& < > " '`).
2. Run EVERY dynamic string through it before innerHTML interpolation (text contexts AND attribute contexts like `title="${...}"`), or rebuild clip cards with createElement/textContent.
3. Also wrap `CSS.escape()` around the data-val attribute selector in smartrecruiters-inject.js:27 (a `"` in values breaks findDeep).
**Verify:** Save a clip whose strength field contains `<img src=x onerror=alert(1)>` → renders as literal text in popup.

### Task 1.5: Validate postMessage bridges in clyde-go
**Severity: MEDIUM-HIGH** — content.js:70–122 and popup.js:116–138 accept `CLYDE_EXTRACT_*`/`CLOSE_SIDEBAR` window messages from ANY origin. Hostile pages can forge "extracted JD" content (prompt-injection into cover letters) or close the sidebar.
**Files:** Modify `content.js`, `popup.js`
**Fix:**
1. Content side: only accept messages where `event.source === sidebarIframe.contentWindow`.
2. Sidebar side: only accept `event.source === window.parent`; pass a per-session nonce in the iframe URL query and require it in every message.
3. Reply with explicit targetOrigin (`chrome-extension://<id>`) instead of `'*'` where possible.
**Verify:** From host page console, `window.postMessage({type:'CLYDE_EXTRACT_RESPONSE', text:'evil'}, '*')` → ignored.

### Task 1.6: Sender validation + message whitelist in clyde-go background.js
**Severity: MEDIUM** — background.js:202–257 has no sender checks and a catch-all `if (msg.type)` route. Any content script on any page (currently <all_urls>) can invoke TEST_PRO_TOKEN, CLEAR_RESUME (destructive), DOWNLOAD_COVER_LETTER.
**Files:** Modify `background.js`
**Fix:**
1. Build an explicit map: which message types are allowed from extension pages (no `sender.tab`) vs content scripts (`sender.tab` present + sender.url hostname on a known-portal list).
2. Drop the catch-all; unknown types → log + return false.
3. Fix the AUTOFILL_* relay branch that returns true without calling sendResponse (channel leak).
**Verify:** Message TEST_PRO_TOKEN from a content-script context → rejected; popup still works end-to-end.

### Task 1.7: Secrets hygiene
**Severity: HIGH (hygiene)** —
- Root `.env` in the clyde repo (inside OneDrive!) holds a live Pinecone key, Google OAuth client secret, Supabase anon JWT; `website/.env.vercel.local` holds an RS256 JWT. Never committed (verified), but they sync to Microsoft's cloud + every linked device.
- Desktop app stores user API keys + Supabase access/refresh tokens in plaintext electron-store JSON (main.js loadSettings ~186–256).
**Fix:**
1. Move dev secrets out of OneDrive (e.g. `C:/Users/skala/.secrets/clyde.env`) and load via dotenv path / direnv; keep a `.env.example` in repo.
2. ROTATE the Pinecone key and Google client secret after moving.
3. Desktop: encrypt API keys + auth tokens with Electron `safeStorage.encryptString()` before persisting; decrypt on load; migrate existing plaintext values on first run (read plaintext → encrypt → delete plaintext keys).
**Verify:** New config JSON shows base64 blobs not raw keys; app still authenticates after restart; old plaintext keys removed.

---

# PHASE 2 — HIGH-VALUE SECURITY/INTEGRITY (pre-launch blockers)

### Task 2.1: Code-sign Windows builds + harden auto-update
**Severity: HIGH (launch blocker)** — No signing cert in package.json win config; electron-updater validates only latest.yml sha512 from GitHub. Compromised GitHub account = silent malicious update; SmartScreen flags every install.
**Files:** Modify `package.json` (build.win), `src/autoUpdater.js`; external: acquire cert
**Fix:**
1. Get Azure Trusted Signing (cheapest path for solo dev, ~$9.99/mo) or an OV cert.
2. Configure electron-builder `win.signtoolOptions`/azure signing, set `verifyUpdateCodeSignature: true`.
3. Keep `CLYDE_ENABLE_AUTO_UPDATE` gated (it is, main.js:4179) until signing verified.
**Verify:** Built exe shows valid publisher signature; updater rejects an unsigned package.

### Task 2.2: License tokens with expiry + per-user revocation
**Severity: MEDIUM-HIGH** — Tokens are deterministic HMAC(userId): no expiry, no revocation except global secret rotation. Leaked token of a resubscribed user works forever.
**Files:** Modify `website/api/license-token.js`, token validation in `website/api/proxy.js` (+ billing.js if it validates), desktop + extension token handling (silent re-mint)
**Fix:**
1. New format: `clyde_lic_<userId>.<expiryEpoch>.<HMAC(userId + expiry + tokenVersion)>` with 60-day validity.
2. Add `token_version` int column to the Supabase users/subscriptions table; bump to revoke one user.
3. Clients: on 401 `token_expired`, silently re-mint via existing auth session; keep accepting legacy-format tokens for 30 days (dual validation), then remove.
**Verify:** Expired token → 401 + successful silent re-mint; bumping token_version invalidates old token only for that user.

### Task 2.3: Gemini key out of URL query strings (server-side)
**Severity: MEDIUM** — `proxy.js:303, 455` and `support-chat.js:164` use `?key=${apiKey}`; extension was already fixed to use headers, proxy wasn't.
**Files:** Modify `website/api/proxy.js`, `website/api/support-chat.js`
**Fix:** Send via `x-goog-api-key` header in all three call sites.
**Verify:** grep `?key=` in website/api → zero hits; Pro Gemini request succeeds.

### Task 2.4: Rate-limit LiveAvatar token minting + fix user enumeration
**Severity: MEDIUM** —
- `website/api/liveavatar-token.js`: unauthenticated, unlimited minting on the paid LIVEAVATAR_API_KEY (cost abuse).
- `website/api/sign-up.js:21–24` and `billing.js:157–161` return "account already exists for this email" to unauthenticated callers (email enumeration).
**Files:** Modify all three
**Fix:**
1. liveavatar-token.js: IP rate limit (reuse proxy.js checkRateLimit, e.g. 3/hour/IP); optionally Cloudflare Turnstile token for the website demo.
2. sign-up/billing: return generic "If this email is new, you'll receive a confirmation" / generic 400; never confirm existence.
**Verify:** 4th token request in an hour → 429; sign-up with an existing email → same response shape as new email.

### Task 2.5: Narrow clyde-go content-script footprint
**Severity: HIGH (privacy + Chrome Web Store rejection risk)** — manifest.json:52–72 injects 13 scripts (~6,000 lines) into `<all_urls>`, all_frames, plus a permanent 1s SPA poller + MutationObserver on every page on the web.
**Files:** Modify `clyde-go/manifest.json`, `background.js`, `content.js`
**Fix:**
1. Static matches narrowed to known ATS domains: `*.myworkdayjobs.com`, `*.smartrecruiters.com`, `boards.greenhouse.io`, `job-boards.greenhouse.io`, `jobs.lever.co`, `*.ashbyhq.com`, `*.icims.com`, `*.taleo.net`, `linkedin.com/jobs*` (+ new portals from Task 4.1).
2. Long-tail/generic sites: `activeTab` + toolbar action triggers `chrome.scripting.executeScript` injection on demand ("Enable Clyde on this site"), optionally persisted via `chrome.scripting.registerContentScripts` per-origin.
3. Clear the SPA setInterval when no FAB is applicable; disconnect MutationObserver when idle.
**Verify:** Visit a random non-ATS site → no Clyde scripts in DevTools Sources; Workday/SR still auto-detect; action-click enables on an unlisted portal.

### Task 2.6: Trim web_accessible_resources + gate PII handlers
**Severity: MEDIUM** —
- WAR exposes popup.html/popup.js/clyde-client.js/anti-ai-writing-style.md to `<all_urls>` (clickjackable sidebar, dead .md exposure).
- `GET_PROFILE`/`GET_RESUME_FILE` return the full PII bundle (resume PDF base64, address, phone, API key) to content scripts on any URL.
- `content.js:986–987` logs RAW PROFILE DATA (full PII) to the page console.
**Files:** Modify `clyde-go/manifest.json`, `background.js`, `content.js`
**Fix:**
1. WAR keeps only smartrecruiters-inject.js + icons used in injected DOM; remove clyde-client.js (importScripts'd, doesn't need WAR) and anti-ai-writing-style.md (no MAIN-world reference found — dead).
2. Gate GET_PROFILE/GET_RESUME_FILE on `sender.tab` + hostname in the known-portal list (pairs with Task 1.6).
3. Delete the RAW PROFILE DATA log and verbose [Gemini Call]/[Clyde Robust Log] lines.
4. (Later, larger) consider chrome.sidePanel API instead of iframing popup.html into untrusted pages — eliminates the clickjack class entirely.
**Verify:** `fetch('chrome-extension://<id>/anti-ai-writing-style.md')` from a page → fails; autofill still works on Workday.

---

# PHASE 3 — RELIABILITY & SYNC

### Task 3.1: Make desktop sync bidirectional and resilient
**Severity: MEDIUM (feature/reliability)** — Sync is push-only, fires only on startup/popup-open (MV3 SW death = clips unsynced for days); `saveTailoredDocToClyde()` and `syncActiveCockpit()` in clyde-client.js are exported but NEVER called; tracker status changes never reach the desktop; clips edited after queuing sync stale data.
**Files:** Modify `clyde-go/background.js`, `popup.js`, `lib/clyde-client.js`, `lib/storage.js`; desktop server: add PATCH endpoint for tracker status
**Fix:**
1. `chrome.alarms.create('clyde-flush', {periodInMinutes: 5})` → flushUnsyncedClips.
2. Call `saveTailoredDocToClyde()` after generateCvJson/generateCoverJson succeed (tailored docs finally reach the desktop knowledge base).
3. Replace the separate unsyncedClips array with per-clip `lastSyncedAt` + dirty flag; sync marks the clip itself.
4. Push trackerStatus changes (Applied/Interviewing/Rejected) via PATCH `/api/jobs/:id`.
**Verify:** Save a clip, kill the SW (chrome://serviceworker-internals), wait 5 min → clip appears in desktop; status change in popup reflects in desktop tracker.

### Task 3.2: Clip identity + single-writer storage
**Severity: LOW-MEDIUM** — Clips identified by `savedAt` ISO timestamp (collision-prone); every mutation is get→modify→set race (popup rename can be clobbered by background extraction completing).
**Files:** Modify `clyde-go/background.js`, `popup.js`, `lib/storage.js`
**Fix:** Add `id: crypto.randomUUID()` to every clip (migrate existing on load); funnel all clip writes through the service worker as single writer (popup sends UPDATE_CLIP messages instead of writing storage directly).
**Verify:** Rename a clip while extraction is in flight → both changes survive.

### Task 3.3: Fix Workday detect() over-match + pro-placeholder sentinel
**Severity: MEDIUM (bug)** —
- `content/portal-handlers/workday.js` detect() falls back to `!!document.querySelector('[data-automation-id]')` — generic attribute used by many sites incl. some SmartRecruiters skins; Workday registers earlier and hijacks them.
- `lib/storage.js:55–61` returns literal `'pro-placeholder'` as the API key; `handleNetworkDraft` (background.js:526) bypasses Gemini.call and sends it (or undefined) straight to googleapis → Pro-token-only users get hard failures on LinkedIn Message drafts.
**Files:** Modify `workday.js`, `lib/storage.js`, `background.js`
**Fix:**
1. Workday fallback → `[data-automation-id="jobPostingHeader"], [data-automation-id^="formField-"]`.
2. Route handleNetworkDraft through Gemini.call (already handles proxy-vs-direct); delete the sentinel; expose `Storage.getAuth() → {mode:'key'|'pro', value}`.
**Verify:** SR page with data-automation-id detects as SmartRecruiters; LinkedIn draft works with Pro token only (no personal key).

### Task 3.4: Autofill UX + error-handling polish
**Severity: LOW-MEDIUM** —
**Files:** Modify `clyde-go/content/form-filler.js`, `content.js`, `lib/gemini.js`
**Fix:**
1. Extend Gemini retry beyond 429: also retry 500/503 (same 4-attempt backoff); user-facing errors get friendly text (raw error only in console).
2. Surface `failedLabels` list in the autofill overlay ("These fields need manual review: …") instead of console-only.
3. Wire `settings.autoFillDelay` (stored but dead) into FormFiller.FILL_DELAY, or delete the setting.
4. Wire the MutationObserver "new fields appeared" path to the existing showReadyState() "Continue filling" toast for multi-step portals (Workday step transitions).
**Verify:** Force a 503 from proxy → retries then friendly error; Workday step 2 shows continue toast.

---

# PHASE 4 — FEATURES & COVERAGE

### Task 4.1: New ATS portal handlers (staged)
**Severity: MEDIUM (market coverage)** — Missing: SAP SuccessFactors, Oracle Recruiting Cloud (modern ORC), ADP Workforce Now, BambooHR, Jobvite, Workable, Recruitee, JazzHR, Paylocity, UKG/Phenom, Eightfold, Indeed Apply. Greenhouse handler targets legacy Select2 boards (stale for job-boards.greenhouse.io).
**Files:** Create `content/portal-handlers/successfactors.js`, `oracle-orc.js`, `workable.js`, `bamboohr.js` (wave 1); modify `greenhouse.js`, `manifest.json`
**Fix (wave 1 priority by market share):** SuccessFactors → Oracle ORC → Workable → BambooHR. Each handler: detect() with portal-specific selectors, getJobDescription, getJobInfo, getFields using querySelectorAllDeep + wait-for-render retry (copy Workday's pattern, not Taleo's). Refresh greenhouse.js selectors for the new Remix boards. Wave 2 later: ADP, Jobvite, Recruitee, JazzHR.
**Verify:** Live test on a real posting per portal: extraction + autofill end-to-end; resume attach still last.

### Task 4.2: DRY the portal handlers + JD extraction
**Severity: MEDIUM (maintainability, do BEFORE 4.1)** — Field-scan loop copy-pasted across greenhouse/lever/taleo/icims/generic with drift; JD extraction block duplicated verbatim 3× (background.js:279–313, content.js:80–111, content.js:1446–1477).
**Files:** Modify `content/form-detector.js` (add `scanStandardFields(root, opts)`), create shared `extractPageJobText(doc)`; refactor 5 handlers + both content.js sites; background's executeScript fallback calls the content-script function.
**Verify:** Each refactored portal still extracts/fills on a live posting; grep finds one copy of each routine.

### Task 4.3: Shadow-DOM + retry support in legacy handlers
**Severity: LOW-MEDIUM** — taleo.js/icims.js/lever.js/greenhouse.js use plain querySelector (no Shadow DOM) and have zero wait-for-render retry.
**Files:** Modify those 4 handlers (largely falls out of Task 4.2 if scanStandardFields uses querySelectorAllDeep + retry).

### Task 4.4: Test foundation for clyde-go
**Severity: LOW-MEDIUM** — Only test is a PDF-canary smoke test. Real parse failures happen (array-flatten fallback at background.js:1979 exists for a reason).
**Files:** Create tests under `clyde-go/tests/`: `form-filler-matching.test.mjs` (normalizeChoiceText/tokenizeChoice), `gemini-postprocess.test.mjs` (JSON sanitize/idMapping/array-flatten), `storage-auth.test.mjs` (getResumeText/getAuth fallback chain), `portal-detect.test.mjs` (detect() regexes vs fixture URLs), plus jsdom fixture-HTML getFields test per portal.
**Run:** `node --test tests/` — all pass; CI-able later.

---

# PHASE 5 — CLEANUP

### Task 5.1: clyde-go repo hygiene
- `git rm "Source Code for Project jd-extracto.txt"` (2 MB legacy dump) and `logs.txt` (27 KB of Stephen's real Workday application URLs — personal PII in version control).
- Remove anti-ai-writing-style.md from WAR (done in 2.6); decide keep-in-repo vs move to desktop.
- Add a pack script with explicit include list (no stray .txt/.md shipping in the store zip).
- Add explicit `content_security_policy` block to manifest (MV3 defaults, documented to prevent accidental loosening).

### Task 5.2: clyde desktop repo hygiene
- Move root-level test-*.js, update*.js, modify_index.js, fill_form.js one-offs into `scripts/` or delete.
- Sweep stale TECH_DEBT.md items (several already remediated per §4 — mark them).
- Begin main.js (4,349 lines) decomposition: extract IPC handler groups into src/ipc/*.js modules (mechanical, low-risk, big maintainability win). Do incrementally, one handler group per commit.

---

# Suggested order & sizing

| Phase | Items | Est. effort | Release needed |
|-------|-------|------------|----------------|
| 1 | 1.1–1.7 | 2–3 days | Server redeploy + ext/desktop patch (1.3, 1.4) |
| 2 | 2.1–2.6 | 3–4 days (+cert lead time) | Yes — store + installer |
| 3 | 3.1–3.4 | 2–3 days | Extension + desktop |
| 4 | 4.2 → 4.1 → 4.3 → 4.4 | 4–6 days | Extension |
| 5 | 5.1–5.2 | 1 day + ongoing | No |

Quick wins shippable in one sitting: 1.2, 2.3, 2.4, 5.1, and the workday detect() fix from 3.3.

# Risks / open questions
- Task 1.3 (pairing token) breaks existing extension installs until users paste the code — needs a graceful "pairing required" UX, and desktop should accept-but-warn for ~1 version before enforcing.
- Task 2.2 token format change needs the 30-day dual-validation window so current users aren't logged out.
- Task 2.5 (narrowing matches) changes the "works everywhere automatically" behavior on unknown portals — the activeTab "Enable on this site" flow must be obvious or users will think the extension broke.
- Code-signing cert (2.1) has procurement lead time — start that first even though other tasks land sooner.
- Pinecone key + Google client secret rotation (1.7) must be coordinated with Vercel env vars and any local dev configs.
