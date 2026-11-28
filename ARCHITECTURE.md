# Code structure

Gather uses TypeScript. Edit application code in `src/` and static assets in `public/`.

| Path | Purpose |
| --- | --- |
| `src/client/app/` | App startup, state, routing, dialogs and event registration. |
| `src/client/core/` | Shared browser helpers, icons, navigation, pin geometry and usage rules. |
| `src/client/services/` | Sign-in, session refresh, Supabase and backend requests. |
| `src/client/features/` | Page and feature controllers, views and related styles. |
| `src/client/styles/` | Shared theme, layout and loading styles. |
| `src/shared/types.ts` | Quiz, participant, chat and account data contracts. |
| `src/shared/quiz/` | Quiz validation, server scoring, rounds and results eligibility. |
| `src/shared/rooms/` | Room protocol, join verification, rate limits and optional service routing. |
| `src/shared/http/` | Shared HTTP routes and authentication. |
| `src/shared/account/` | Usage, image handling, report saving and deletion. |
| `src/shared/chat/` | Chat permissions, mentions and announcement countdowns. |
| `src/shared/media/` | Encrypted room images and resumable downloads. |
| `src/shared/site/` | Site news and access-request rules. |
| `src/server/` | Development HTTP/WebSocket server using the shared rules. |
| `src/worker/` | Cloudflare HTTP handlers, room/account Durable Objects and bindings. |
| `public/` | HTML shell, public configuration, images, fonts and browser libraries. |
| `scripts/` | Source compilation, build, deployment and validation commands. |
| `run/main.py` | Python launcher for the development server. |
| `wrangler.jsonc` | Cloudflare bindings, migrations and request limits. |
| `tsconfig*.json` | Browser and server TypeScript configurations. |
| `.github/workflows/` | Website build and GitHub Pages publishing. |

## Feature folders

| Folder in `src/client/features/` | Purpose |
| --- | --- |
| `home/`, `auth/`, `join/` | Home, sign-in and participant joining. |
| `library/` | Saved quizzes, tags, filters, open rooms and saved results. |
| `editor/` | Questions, edit history, game settings and quiz imports/exports. |
| `live/` | Lobby, room settings, answers, timed reveals, host review and reconnects. |
| `avatars/` | Avatar customization, rendering and artwork credits. |
| `results/` | Report views, analysis, charts and downloads. |
| `chat/`, `news/` | Room conversations, announcements and site news. |
| `account/`, `settings/`, `legal/` | Account actions, usage, About, support and policies. |
| `media/` | Photo optimization, image encryption and browser caching. |

Feature controllers are registered in `src/client/app/bootstrap.ts`; routes live in `router.ts`. Keep feature styles beside their controllers. Browser JavaScript is generated from TypeScript.
