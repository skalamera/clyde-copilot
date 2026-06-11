# Clyde — Technical Debt & Risk Register

Last updated: 2026-06-11 (deep-review remediation pass)

This file tracks known structural debt and strategic risks that are
deliberately NOT being fixed in a single pass, plus the mitigations that
ARE in place. Review before major releases.

---

## 1. Monolith refactor (deferred — tracked here)

Current state:
- `main.js` — ~4,350 lines, all app lifecycle + ~110 IPC handler
  registrations in one file.
- `src/renderer/App.jsx` — ~12,650 lines, every view/modal/wizard in one
  component file.
- `clyde-go/background.js` — ~2,180 lines; duplicated Gemini call paths
  (its own `callGemini`/`callGeminiJson` AND `lib/gemini.js`).

Why deferred: both apps work, ship, and have test coverage at the module
level. A big-bang refactor risks regressions for zero user-visible gain.

Recommended incremental path (do opportunistically, not all at once):
1. main.js: extract IPC registration into domain modules
   (`src/ipc/capture.js`, `src/ipc/billing.js`, `src/ipc/knowledge.js`,
   etc.), each exporting `register(ipcMain, ctx)`. Pure code motion, no
   behavior change; test files already mirror domains.
2. App.jsx: split top-level views (Tracker, QuestionBank, Knowledge,
   Calendar, Trends, MockInterviews, SettingsWizard) into their own files
   first — they are the least entangled. Keep shared state in App.jsx
   until a real state container is justified.
3. clyde-go: delete the duplicate Gemini fetch logic in background.js and
   route everything through `lib/gemini.js` (now the hardened path:
   header-based API key, no token logging, correct model name).
4. Remove dead/legacy layers when touched: `interviewManager.js` vs
   `sessionManager.js`, `audioCapture.js` legacy path vs
   `audioEngineSidecar.js`, root `content.js` placeholder in clyde-go.

Rule of thumb: never add a new IPC handler or view to the monolith files;
put new code in a module and import it.

## 2. Repo hygiene (partially addressed)

- `website/.env` / `.env.vercel.local` exist on disk but are gitignored
  and NOT tracked (verified). Keep it that way; rotate any keys that were
  ever committed historically.
- Root clutter (test WAVs, logs, marketing_agents.db, scratch scripts
  `update_main_ui*.js`, `modify_index.js`, `UsersskalaAppDataRoamingclyde/`)
  should be moved to `tmp/` or deleted when convenient. None of it ships
  (electron-builder files allowlist excludes it).
- `playwright` + `@playwright/mcp` are runtime deps but only used for
  tooling — move to devDependencies on next dependency pass.

## 3. Strategic / product risks (not code-fixable; mitigations)

### 3.1 "Undetectable mode" exposure
Screen-share invisibility (setContentProtection) is a core marketed
feature ("The Undetectable Agentic Partner"). Risks: interview-platform
ToS action, employer backlash, app-store / payment-processor policy
friction, press risk.
Mitigations in place / recommended:
- Terms of Service already requires lawful use and following
  workplace/platform rules (website Terms page).
- Keep the feature user-toggleable (it is) and document it honestly.
- Recommended: add an explicit "acceptable use" clause covering
  jurisdictions where call recording/assistance requires consent, and
  have counsel review before broad launch (the Terms page itself says
  "Replace or review them with counsel").

### 3.2 Windows-only audio sidecar
The Rust capture engine is Win32-only; macOS needs ScreenCaptureKit work.
Support doc claims "macOS support in closed developer beta" — keep that
claim aligned with reality or remove it.

### 3.3 Model-name drift
Proxy allowlists are the source of truth:
- Chat: gpt-4o / gpt-4o-mini / gpt-3.5-turbo; gemini-2.5-flash/pro,
  gemini-1.5-flash/pro. Fallbacks: gpt-4o-mini, gemini-2.5-flash.
- Desktop realtime models (gpt-realtime-2 etc.) are config-overridable;
  expect provider renames and keep defaults in one constant per module.
- Fixed in this pass: clyde-go `gemini-3.5-flash` typo; support_doc.md
  "Gemini 3.5 Flash" / "Qwen 3.6" claims.

### 3.4 Proxy cost exposure (mitigated, monitor)
Signed license tokens + per-user rate limits now gate the Vercel proxy
(see SECURITY-NOTES below and website/api/proxy.js). Remaining residual
risk: rate-limit state is per-serverless-instance (in-memory), so a
determined abuser spread across instances gets a higher effective cap.
If costs ever spike, move limits to Upstash Redis / Vercel KV and add
per-user daily token budgets sourced from Stripe plan metadata.

## 4. Security hardening completed in this pass (2026-06-11)

- website/api/proxy.js: bare-UUID license tokens disabled by default
  (CLYDE_ALLOW_UUID_LICENSE=true to temporarily re-enable during
  migration); HMAC-signed `clyde_lic_<userId>.<sig>` tokens verified
  with timing-safe compare; per-user/per-route sliding-window rate
  limits (CLYDE_PROXY_CHAT_RPM / EMBED_RPM / TRANSCRIBE_RPM).
- website/api/license-token.js (new): mints signed tokens for
  authenticated Pro users. Requires CLYDE_LICENSE_SIGNING_SECRET env.
- Desktop entitlements (src/entitlements.js): cached Pro degrades to
  free if never server-verified, last verified >7 days ago, or expired
  >3 days past period end. Stops settings-file tampering.
- Extension (clyde-go): Gemini API key moved from URL query string to
  x-goog-api-key header (4 call sites); Authorization/header logging
  removed from lib/gemini.js; web_accessible_resources now use
  use_dynamic_url so web pages can't deterministically frame popup.html.
- Desktop local API (src/extensionServer.js, port 4593): Origin guard —
  http(s) web-page origins get 403; only extension origins (or no
  Origin) are allowed; CORS no longer wildcarded.

## 5. Deployment checklist for the fixes above

Vercel env to set:
- CLYDE_LICENSE_SIGNING_SECRET (long random string; rotating it revokes
  all issued license tokens)
- STRIPE_CLYDE_PRO_PRICE_ID_MONTHLY / STRIPE_CLYDE_PRO_PRICE_ID_ANNUAL
  (create the annual price in Stripe; legacy STRIPE_CLYDE_PRO_PRICE_ID
  remains as fallback)
- Optional: CLYDE_PROXY_CHAT_RPM / CLYDE_PROXY_EMBED_RPM /
  CLYDE_PROXY_TRANSCRIBE_RPM, CLYDE_ALLOW_UUID_LICENSE=true (only during
  extension-token migration, then remove)

Client migration:
- Clyde Go options page "Pro token" should be a token minted from
  POST /api/license-token (Supabase JWT auth), not a user UUID.
  Until users migrate, set CLYDE_ALLOW_UUID_LICENSE=true, announce,
  then flip it off.
