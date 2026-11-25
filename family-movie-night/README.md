# Family Movie Night

A web app where one household rates movies on three profiles and gets a shared **queue** of what everyone will happily watch.

- **React 18 + Vite + Tailwind CSS 4 + Lucide icons**
- **Firebase Auth** (Google Sign-In) and **Cloud Firestore** (ratings sync across devices)
- **TMDB** for search, posters, MPAA ratings, runtimes and synopses
- **Demo Mode** with 150 built-in movies and sample ratings on 16 of them — no keys needed

## Run it right now (Demo Mode)

```bash
npm install
npm run dev
```

Open http://localhost:5173. With no keys in `.env.local` the app starts in Demo Mode: sample ratings for all three profiles, saved in that browser only. Posters are drawn as title cards because there is no TMDB key yet. The built-in list's scores and runtimes are approximate; real data comes from TMDB once you add a key.

## Go live: keys and setup

Copy the template, then fill it in as you go:

```bash
cp .env.example .env.local
```

### 1. TMDB key (about 2 minutes)

1. Create a free account at https://www.themoviedb.org/signup.
2. Go to **Settings → API** (https://www.themoviedb.org/settings/api) and request an API key. Choose "Developer", personal use.
3. Copy the **API Key** (the short one) into `VITE_TMDB_API_KEY`. The long "API Read Access Token" also works.

With only this key set, the app still runs in Demo Mode but browses and searches the real TMDB catalog with real posters.

### 2. Firebase project

1. Go to https://console.firebase.google.com and click **Add project**. Name it anything. Google Analytics is not needed.
2. On the project overview click the **Web** icon (`</>`) to register a web app. Skip Firebase Hosting for now.
3. Firebase shows a `firebaseConfig` object. Copy four values into `.env.local`:

| `firebaseConfig` field | `.env.local` variable |
| --- | --- |
| `apiKey` | `VITE_FIREBASE_API_KEY` |
| `authDomain` | `VITE_FIREBASE_AUTH_DOMAIN` |
| `projectId` | `VITE_FIREBASE_PROJECT_ID` |
| `appId` | `VITE_FIREBASE_APP_ID` |

### 3. Turn on Google Sign-In

1. In the Firebase console: **Build → Authentication → Get started**.
2. **Sign-in method → Google → Enable**. Pick a support email. Save.
3. `localhost` is authorized by default. When you deploy, add your site's domain under **Authentication → Settings → Authorized domains**.

### 4. Create the database and lock it down

1. **Build → Firestore Database → Create database**. Choose **Production mode** and any region near you.
2. Open the **Rules** tab, paste the contents of [`firestore.rules`](./firestore.rules), and click **Publish**.

Those rules let each signed-in Google account read and write only its own household.

### 5. Start it

```bash
npm run dev
```

Restart the dev server after editing `.env.local`. You should see the Google sign-in screen. Sign in, pick a profile, and rate away. Sign in with the same Google account on any other device to see the same ratings.

Your finished `.env.local` looks like this:

```bash
VITE_TMDB_API_KEY=0123456789abcdef0123456789abcdef
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef123456
VITE_DEMO_MODE=false
```

Firebase web keys are meant to ship in the browser; the Firestore rules are what protect the data. The TMDB key is also visible in the built site, which is fine for a personal app.

### 6. Put it online with automatic updates

The app updates itself. Every build is stamped with an id; a running copy checks `/version.json` when it opens, whenever it comes back to the foreground, and every 5 minutes. If the id has changed it reloads into the new build (or, if someone is mid-session, shows a one-tap "Update now" bar). Nobody reinstalls or clears anything. The current build time is shown at the bottom of every page so you can confirm an update landed.

Only your account can publish, because publishing happens from your GitHub and hosting accounts.

**Recommended: Vercel (push to update)**

1. Put this folder in a GitHub repo under your account.
2. At https://vercel.com/new, import the repo. Vercel detects Vite on its own.
3. In the project's **Settings → Environment Variables**, add the same `VITE_*` values from `.env.local`, then redeploy.
4. Add the Vercel domain to Firebase **Authentication → Settings → Authorized domains**.

From then on, every push to `main` deploys, and every phone picks it up the next time the app is opened. `vercel.json` already sets the cache headers this relies on.

**Alternative: Firebase Hosting (one command to update)**

```bash
npm i -g firebase-tools
firebase login                 # your Google account
firebase use --add             # pick the project from step 2
npm run deploy                 # builds and publishes
```

Run `npm run deploy` again whenever you change something. `firebase.json` is already set up.

**On the phones:** open the site and use **Share → Add to Home Screen** (iPhone) or **Install app** (Android). It then opens full-screen like an app and still updates itself.

## How it works

### Tabs

- **Queue** — one ranked list of what all three of you can watch together, with lane chips and filters.
- **Rate** — go through a "best of" list one movie at a time. It skips anything the current profile already rated and keeps loading more (with a TMDB key, hundreds per list).
- **Search** — find one specific movie.
- **Mine** — everything the current profile has rated.

### Profiles

One Google account is one household with three fixed profiles: `parent`, `kid1`, `kid2`. The kids never need accounts. Switch by tapping an avatar in the header; rename them under **Edit profiles** at the bottom of any page. The queue rules treat the first profile as the parent.

### Ratings

| | Status | Stored as | Stars |
| --- | --- | --- | --- |
| Watched it | **Watched** | `seen` | Required, 0.5–5 in half steps |
| Watched it | **Watch again** | `again` | Required, 0.5–5 |
| Haven't watched it | **Want to** | `unseen` | None |
| Haven't watched it | **Indifferent** | `meh` | None |
| Haven't watched it | **No thanks** | `pass` | None |

### Queue rules (`src/lib/together.js`)

Each movie lands in at most one lane, checked in this order:

1. **Ruled out.** Anyone said No thanks, or rated it 2 stars or lower without marking Watch again. Hidden from the queue, listed under "ruled out" at the bottom.
2. **New to us.** All three have weighed in, the kids haven't watched it, the parent either hasn't or would watch again, and at least one person actively wants it. Indifferent is allowed. Sorted by match %: the TMDB audience score, blended 50/50 with the parent's stars on a parent rewatch, minus 10 points per Indifferent.
3. **Family favorite.** All three rated it 4+ stars and at least one would watch again. Sorted by family average.
4. **Needs a vote.** Exactly two want to watch or rewatch it and the third has not rated it at all.

Filters (genre, G / PG / PG-13, runtime) apply to the whole queue.

`npm test` runs these rules against the demo data.

## Database schema (Firestore)

```
households/{uid}                      ← uid = the signed-in Google account
  profiles: [
    { id: "parent", name: "Parent", avatar: "director" },
    { id: "kid1",   name: "Kid 1",  avatar: "popcorn"  },
    { id: "kid2",   name: "Kid 2",  avatar: "clapper"  }
  ]
  createdAt: timestamp

households/{uid}/movies/{tmdbId}      ← one document per rated movie
  movie: {
    id: 105,                          // TMDB id
    title: "Back to the Future",
    year: 1985,
    poster: "/abc123.jpg",            // TMDB poster path, or null
    cert: "PG",                       // US MPAA rating, or null
    runtime: 116,                     // minutes
    genres: ["Adventure", "Comedy", "Sci-Fi"],
    vote: 8.3,                        // TMDB audience score, 0–10
    overview: "…",
    detailed: true                    // runtime + cert have been fetched
  }
  ratings: {
    parent: { status: "again",  stars: 5    },
    kid1:   { status: "unseen", stars: null },
    kid2:   { status: "seen",   stars: 3.5  }   // a missing key = hasn't rated it
    // status is one of: seen | again | unseen | meh | pass
  }
  updatedAt: timestamp
```

Keeping all three ratings on one movie document means the whole queue comes from a single realtime listener, and a copy of the movie details is stored so the lists never need to call TMDB.

## Project layout

```
src/
  App.jsx                   sign-in gate, header profile switcher, tabs
  index.css                 theme tokens, status stubs, animations
  lib/
    config.js               reads .env, decides Demo vs live
    firebase.js             Auth + Firestore setup
    store.js                local (demo) store and Firestore store, same interface
    autoUpdate.js           checks for a newer build and reloads into it
    tmdb.js                 search, rating decks, details; falls back to the built-in list
    together.js             the queue rules (pure functions)
    demoData.js             built-in movie list and sample ratings
  components/
    Queue.jsx               the shared queue, lanes and filters
    Rate.jsx                rate-through, one movie at a time
    Browse.jsx              search
    MyTickets.jsx           one profile's ratings
    RateSheet.jsx           movie details and rating sheet
    Profiles.jsx            profile editor
    ui.jsx                  posters, stars, status stubs, avatars, queue rows
firestore.rules             security rules to paste into Firebase
vercel.json / firebase.json hosting config for either deploy route
public/                     home-screen icons and web app manifest
.env.example                key template
tests/together.test.mjs     rule checks
```

## Troubleshooting

- **Still in Demo Mode after adding keys:** all four `VITE_FIREBASE_*` values must be set, `VITE_DEMO_MODE` must not be `true`, and the dev server must be restarted.
- **"Firestore refused access":** the rules from step 4 have not been published.
- **"This domain is not authorized":** add the domain in step 3.3.
- **An update isn't showing up:** check the build time at the bottom of the page. If it is old, close and reopen the app once; if your host isn't Vercel or Firebase, make sure it doesn't cache `index.html` or `version.json`.
- **Sign-in popup closes on a phone:** some in-app browsers block popups. Open the site in Safari or Chrome.
- **No MPAA rating or runtime on a movie in Rate or Search:** TMDB list results do not include them. They load when you open or rate the movie.

This product uses the TMDB API but is not endorsed or certified by TMDB.
