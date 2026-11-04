# Architecture

Gather is a browser app built with JavaScript modules and CSS. GitHub Pages serves the frontend. Supabase provides authentication, saved quizzes, saved reports and image storage. A Cloudflare Worker handles live rooms, WebSockets and account services.

## Source map

```text
public/
  index.html                 HTML shell
  app.js                     Stable browser entrypoint
  app/
    bootstrap.js             Connects feature controllers and starts the app
    router.js                Hash routes and page transitions
    state.js                 Current session, editor and live-room state
    ui.js                    Navigation, page shell, notices and dialogs
    events.js                Delegates events to feature handlers
    accessibility.js         Dialog focus and keyboard guards
    startup.js               Public settings, session restoration and startup
  core/                      DOM helpers, icons, question types and reordering
  services/
    api.js                   HTTP, Supabase database and backend requests
    session.js               Authentication requests and token refresh
  features/
    home/                    Landing page
    auth/                    Sign-in, sign-up, recovery and verification
    join/                    Quiz joining
    library/                 Saved quizzes, reports and open rooms
    editor/                  Quiz model, editing, uploads and import/export
    live/                    Room connection, screens, answers and timing
    results/
      page.js                Loads a live or saved detailed report
      index.js               Report state, navigation and event handling
      views/                 Overview, responses, participants, rounds, downloads
      data.js                Report analysis and answer formatting
      export.js              PDF, CSV, HTML and ZIP generation
      charts.js              Report charts
      styles.css             Detailed results styling
    learn/
      page.js                App route and account-sync bridge
      index.js               Learning state, practice flow and event handling
      views/                 Home, topics, cards, library, practice and other pages
      progress.js            Device progress and optional account sync
      map.js                 Interactive map controller
      styles.css, map.css    Learning and map styling
    chat/                    Room chat, access applications and related actions
    news/                    Live site announcement and dismissal
    legal/                   Policy text, page rendering and return links
    media/                   Encrypted room images and browser storage
  assets/images/             App logos
  fonts/                     Local fonts
  learn-data/                Geography data, flags and source attribution
  styles/                    Shared theme, components and responsive rules
  vendor/                    Third-party browser libraries and their licences
shared/
  quiz/engine.js             Quiz rules, scoring, rounds, validation and reports
  rooms/protocol.js          WebSocket message validation and limits
  http/api.js                Shared HTTP routes, auth and response handling
  media/room-media.js        Room image preparation and range responses
  chat/                     Chat protocol and access rules
  learn/progress.js          Progress validation and merge rules
  site/control.js           Announcement and access-request rules
worker/
  index.js                   Worker entrypoint and Durable Object exports
  http/                      Fetch handler and RPC error handling
  rooms/                     Quiz Durable Object and room adapter
  accounts/                  Account Durable Object
  config.js                  Retention and storage constants
scripts/                     Development server, build and release checks
run/main.py                  Local development launcher
wrangler.jsonc               Worker bindings, migrations and rate limits
.github/workflows/           GitHub Pages build and deployment
```

## How requests travel

```mermaid
flowchart LR
  Pages[GitHub Pages] --> Browser[Browser app]
  Browser -->|Sign-in, saved quizzes, reports, images| Supabase[Supabase]
  Browser -->|HTTP and WebSocket| Worker[Cloudflare Worker]
  Worker -->|Verify account, load quizzes, save reports| Supabase
  Worker --> Rooms[ROOMS: quiz Durable Objects]
  Worker --> Accounts[ACCOUNTS: account Durable Objects]
```

The browser loads public service settings from `/api/config`. Public Supabase keys identify the app; user access tokens and database policies control access to account data. Server credentials belong in environment settings, never browser code.

Hosts save quizzes in Supabase, then ask the Worker to create a live room. Participants join with a room code. A room Durable Object owns the clock, answers, scores and reconnect state, and broadcasts snapshots over WebSockets. The browser renders those snapshots. Saving a report sends the selected report detail to Supabase. Account Durable Objects hold room indexes, learning progress and service state.

`worker/index.js` preserves the Durable Object class names used by the bindings and migrations. Moving implementation files does not create a new storage namespace.

## Changing a feature

Start in its `public/features/` folder. `page.js` renders or mounts the page; `actions.js`, `forms.js`, `events.js` and `changes.js` handle interactions where needed. Results and Learn keep individual screen templates in `views/`. Data processing and downloads have separate modules.

`app/bootstrap.js` creates one runtime per app instance. Feature factories receive shared state and explicit callbacks through that runtime. Action and form maps are registered by name; input, change and keyboard handlers run in order. Register a new controller here and add its route in `app/router.js` when necessary. Keep feature-specific behavior in the feature folder and reusable helpers in `core/` or `services/`.

Results and Learn view factories receive live getters into their controller's state. This keeps asynchronous navigation and account changes connected to the current instance without duplicating state or adding circular module imports.

Change quiz rules in `shared/quiz/engine.js`, shared HTTP behavior in `shared/http/api.js`, and Cloudflare transport or persistence in `worker/`. The development server uses the same shared rules and HTTP routes with a local room adapter.

## Build and checks

- `npm run dev` starts the development server. `python3 run/main.py` is the local launcher.
- `npm run check` checks JavaScript syntax, relative module and asset references, and reconnect behavior.
- `npm run privacy` scans publishable source for private configuration and credentials.
- `npm run build` creates `dist/`, writes public browser configuration and versions nested assets for cache updates. Shared CSS imports are combined into one stylesheet.

`public/app.js` and `public/styles.css` remain stable entry URLs. `scripts/legacy-assets.json` maps relocated browser assets to compatibility files generated during the build, so older open tabs can still load them. New source imports use the feature paths.

The Pages workflow builds `dist/` and publishes it after a push to `main`. Worker deployment uses the bindings in `wrangler.jsonc`. Deploy backend changes before publishing frontend code that needs them. Keep existing authentication, origin validation, request limits and database access controls when extending either side.
