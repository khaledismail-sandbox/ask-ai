# Ask AI — Chat Assistant Demo

A static, no-build clone of a GPT-style AI chat assistant app (onboarding →
signup → chat → soft paywall / hard paywall), instrumented end-to-end with
Amplitude (manual sessions, explicit event tracking, Session Replay at 100%
sample rate).

Plain HTML/CSS/vanilla JS. No npm, no bundler, no server-side code — the
folder can be opened directly or served as-is from GitHub Pages.

## Routes

| Path            | Screen                                              |
|-----------------|------------------------------------------------------|
| `/`             | 3-slide onboarding carousel                          |
| `/signup`       | Account creation (demo only)                         |
| `/login`        | Returning user entry (demo only, friction-free)      |
| `/chat`         | Chat home (free users capped at 3 messages)          |
| `/trial`        | Soft paywall — 7-day free trial                      |
| `/upgrade`      | **Control** — blocking upgrade sheet (hard paywall)  |
| `/upgrade-v2`   | **Treatment** — inline, non-blocking upgrade banner. Only reachable by typing the URL directly; never linked or auto-routed from the app. |

Routing uses real paths via the History API (`pushState`), not query strings
or a hash. `404.html` implements the [spa-github-pages](https://github.com/rafgraph/spa-github-pages)
redirect trick so direct loads/refreshes of any route work on GitHub Pages,
and it auto-detects whether it's running on a GitHub Pages *project* site
(`https://user.github.io/repo/...`) or a user/org site or custom domain — no
manual base-path configuration needed.

## Running locally

Double-clicking `index.html` works for a quick look, but browsers block
`history.pushState` on the `file://` protocol, so full path-based navigation
(and refreshing a deep link) only works when served over `http://`. To test
that locally, run a static file server from this folder, e.g.:

```bash
python3 -m http.server 8080
```

then open `http://localhost:8080`.

## Publishing to GitHub Pages

1. Create a new GitHub repository (e.g. `ask-ai-demo`).
2. Push the contents of this folder to the repository's `main` branch:
   ```bash
   cd ask-ai-demo
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
3. In the repository, go to **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to "Deploy from a branch",
   pick branch **main** and folder **/ (root)**, then **Save**.
5. Wait a minute for the build, then open the URL GitHub shows you
   (`https://<your-username>.github.io/<repo-name>/`). All routes —
   `/chat`, `/trial`, `/upgrade`, `/upgrade-v2`, etc. — work directly and on
   refresh.

## Amplitude instrumentation

- Browser SDK 2.x + Session Replay plugin loaded from `cdn.amplitude.com`
  (no npm). `autocapture: false` and `defaultTracking: false` — every event
  is sent explicitly by name. Session Replay runs at `sampleRate: 1`.
- Sessions are managed manually: `App Opened` is the session-start signal
  (`amplitude.setSessionId(...)` is set on load; Amplitude's automatic
  session handling is never relied on).
- On first load, `identify()` sets 9 user properties (`platform`, `country`,
  `app_version`, `acquisition_source`, `cohort_week`, `plan_tier`,
  `utm_source`, `utm_medium`, `utm_campaign`) — always populated, never
  `(none)`. The random picks (country, acquisition source, campaign) persist
  in `sessionStorage`, so each new browser tab gets a fresh, realistic demo
  identity.
- Every event carries 6 governed properties merged in automatically:
  `platform`, `country`, `app_version`, `acquisition_source`, `cohort_week`,
  `plan_tier`.
- `Plan Upgraded` sends `revenue`, `price`, `quantity`, `revenueType`,
  `productId` as top-level event properties (not nested).

### Deterministic friction flow (for reproducible session replays)

A new signup always gets the control experience: a hard 3-message cap. After
the 3rd `Message Sent` + `AI Response Received` pair, the next send attempt
shows a brief "out of free messages" state and navigates to `/upgrade`.
Every time, `Cancel` on `/upgrade` fires `Upgrade Abandoned` and returns to a
still-capped chat (the next send re-triggers the wall); `Continue` fires
`Plan Upgraded` and unlocks unlimited messages. Starting a trial (`/trial`)
or logging in (`/login`) removes the cap for the rest of the session.

`/upgrade-v2` never enforces the cap and never fires `Upgrade Abandoned` — it
exists purely as a demo artifact for comparing the non-blocking treatment
against the control, and must be reached by typing the URL directly.
