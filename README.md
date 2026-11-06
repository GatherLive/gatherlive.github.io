# Gather

Free, open-source live quizzes for everyone.

[Open Gather](https://gatherlive.github.io/) | [How to use Gather](how-to-use.md) | [Architecture](ARCHITECTURE.md) | [Buy me a coffee](https://buymeacoffee.com/gatherlive)

- Join with a six-digit code and a name. No guest account needed.
- Create quizzes with 11 question types, images, timers and leaderboards.
- Host multiple rounds with optional rewards and reusable quiz sets.
- Organize quizzes with tags, search and hosted filters.
- Rejoin open rooms or close them from My quizzes.
- Review detailed results with clear question cards and participant reports.
- Download PDF, HTML or CSV results in Gather’s dark appearance.
- Apply for room chat access or use a one-time invitation code.
- Use host announcements, chat replies and emoji reactions between questions.
- Add announcement countdowns and optional participant mentions.
- See site news beneath the header and dismiss it on your device.
- Import/export quiz JSON or copy a prompt for your preferred AI tool.
- Learn geography with country cards, maps, flags, capitals and practice tests.
- Manage account settings, saved data and usage in Settings.

No ads, analytics trackers or data sales. Information is used to provide and secure the service. Learning progress stays on your device unless you enable account sync. Terms and Conditions and Privacy Policy are available during sign-up and from Settings, Join quiz and Learn.

Room chat and host announcements clear when a quiz ends. Ended rooms and unsaved results expire after 15 minutes; unfinished rooms expire after 24 hours. Saved reports remain until deleted. Site news has its own expiry and dismissal.

Accounts include 100 saved quizzes, 200 uploaded images, 200 detailed results and up to 500 participants per quiz. Settings → Usage shows your allowance, lets you delete saved content and accepts requests for higher limits.

Node.js 22+ is required. Configure the service using `.env.example`, then run:

```sh
npm ci
npm run dev
```

The Python launcher, `python3 run/main.py`, also works. Open `http://127.0.0.1:8000`.

Application code lives in `src/`: browser features in `client/`, common rules in `shared/`, the development server in `server/` and Cloudflare code in `worker/`. Static assets stay in `public/`. Edit TypeScript source; generated JavaScript is build output. See [ARCHITECTURE.md](ARCHITECTURE.md) for the feature map.

Run `npm run check` and `npm run privacy` before publishing. `npm run build` creates the GitHub Pages website in `dist/`. The check command includes TypeScript validation; `npm run typecheck` runs that part alone.

Licensed under [AGPL-3.0](LICENSE). [Learning data and asset credits](public/learn-data/README.md).
