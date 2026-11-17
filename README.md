# PULSE — Your World. One Feed.

PULSE is a mobile-first discovery and personal tracking app. It pulls movies, TV, games, sports, technology and world news into one personalized feed, with a private watchlist, collections, notes, reminders and a release calendar.

It is a static Progressive Web App: React + TypeScript + Vite, Tailwind CSS, Framer Motion, Lucide icons, React Router and Dexie (IndexedDB). It has no backend, and it deploys to GitHub Pages.

## Features

| Area | What it does |
| --- | --- |
| **Home** | Greeting with the date, a featured carousel, trending, upcoming releases, recommendations, latest updates (paged), recently viewed, quick category links and a category filter. You can show or hide each section. |
| **Discover** | A separate screen for each area. **Movies & TV:** genre filters, trailers, now playing, coming soon, top rated, airing today. **Gaming:** platform filters, popular, new releases, upcoming. **Sports:** live and upcoming scores plus headlines for each league. **Tech:** AI, gadgets, software and innovation topics, plus the Hacker News top list. **World:** news, science, and discoveries (featured article, picture of the day, on this day). |
| **Trending** | Real rankings only: TMDB trending, RAWG library adds, Wikipedia page views, Hacker News points. When a source can't be reached, the screen says so. It never shows an invented ranking. |
| **Release calendar** | List view and month view, category filters, countdowns, one-tap release reminders, and `.ics` export. |
| **Watchlist** | Save movies, shows, games, articles and events. Create custom collections, add notes, set status (planned, in progress, completed), search, filter, sort, and undo a removal. |
| **Search** | Searches movies, TV, games, news and your saved items at once. Includes suggestions, recent searches, trending searches and category filters. |
| **Details** | A page for every item: hero image, metadata, trailers, cast, gallery, related items, a link to the source, save, reminder, share and add-to-calendar. |
| **Personalization** | Dark, light or auto theme; six accent colors; English or Hebrew with full RTL; favorite and enabled categories; preferred content types; region. |
| **Notifications** | Release reminders, a weekly watchlist nudge and custom reminders, using the browser Notification API through the service worker. |
| **Data** | Everything is stored in IndexedDB. You can export and import JSON (API keys are left out of exports by default), clear the cache, or reset. |
| **PWA** | Installable, works offline, iOS home-screen ready, and prompts you when an update is available. |

## Data sources

| Source | Used for | Needs a key? |
| --- | --- | --- |
| [TMDB](https://www.themoviedb.org/) | Movies, TV, trending, upcoming, trailers | Yes (free) |
| [RAWG](https://rawg.io/apidocs) | Games, covers, platforms, release dates | Yes (free) |
| [TVmaze](https://www.tvmaze.com/api) | TV schedule, premieres, show search | No |
| Wikipedia REST feed | Most-read articles, in the news, on this day, featured content | No |
| Hacker News (Algolia) | Tech news, points-ranked trending | No |
| Spaceflight News API | Science and space news | No |
| ESPN public site API | Scores and headlines | No |
| RSS / Atom feeds (configurable) | BBC, The Verge, Ars Technica, TechCrunch, GameSpot, Variety, ScienceDaily… | No |

Before you rely on these sources, note how each one behaves:

- **API keys** are never committed. You add them in the app under **Profile → Integrations**. They are stored only in that browser's IndexedDB and sent straight from the browser to TMDB or RAWG.
- **Keys are visible.** A key used in browser code can be read by anyone with access to that device or its developer tools. Use free, read-only keys only.
- **RSS feeds go through a proxy.** Most publishers don't send CORS headers, so feeds are fetched through public CORS proxies (allorigins and codetabs by default). You can change the proxy list under **Profile → Sources**.
- **Sample content without keys.** When TMDB or RAWG isn't connected, the Discover screens show a few fictional titles labeled **Sample**. These never appear in Trending or the Calendar.
- **Freshness is shown.** Every feed displays a last-updated time. Cached copies are marked as offline.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
npm run icons      # regenerate PWA icons (uses Playwright's Chromium)
```

To build for a GitHub Pages project site locally, use `BASE_PATH=/Pulse/ npm run build`.

## Deployment (GitHub Pages)

`.github/workflows/deploy.yml` runs on every push:

- **Every branch and pull request:** installs dependencies, type-checks, builds, and checks the output.
- **Pushes to `main`:** also deploys `dist/` to GitHub Pages. The build sets the correct `/<repo>/` base path through `actions/configure-pages`.

Two settings make the build work under a repository subpath:

- **Deep links:** `dist/404.html` is a copy of `index.html`, so a URL like `/Pulse/watchlist` loads the app, which then routes on the client. `.nojekyll` is included.
- **Asset paths:** all asset and manifest paths are relative to the base path.

### One-time setup

1. In the repository, open **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main`, or run the workflow manually from the **Actions** tab.

The site is then published at `https://<user>.github.io/<repo>/`.

## Install on iPhone

1. Open the site in **Safari**.
2. Tap **Share**, then **Add to Home Screen**, then **Add**.
3. Launch PULSE from the new icon. It runs full-screen and respects the notch and home indicator.

For notifications on iOS: they need iOS 16.4 or later, and PULSE must be opened from the Home Screen. Allow notifications in **Profile → Notifications**.

## Updating

Push to `main` and the workflow redeploys. Installed copies check for updates when they're opened and every hour. When a new version is ready, a "new version" banner appears; tap **Reload** to switch. Saved data in IndexedDB is kept across updates.

## Limitations

- **Reminders need the app open.** Without a push server, reminders fire only when PULSE is open or comes back to the foreground. For alerts you can count on, use the `.ics` export.
- **Public endpoints can fail.** Public CORS proxies and the unofficial ESPN endpoint can be rate-limited or go offline. When that happens, the source is skipped and listed as failed in the **Sources** panel.
- **Region-specific data.** TMDB and TVmaze results depend on the region setting.

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB. Game data is from [RAWG](https://rawg.io). TV data is from [TVmaze](https://www.tvmaze.com) (CC BY-SA). Content from Wikipedia is CC BY-SA. Every article links to its original publisher.
