# Family Movie Night

A web app for a group of people who watch movies together. There are no accounts or passwords: you type your name once and pick it from a list after that. Everyone rates what they've watched, and the app learns each person's taste and suggests what to watch for whoever is there tonight.

- **React 18 + Vite + Tailwind CSS 4 + Lucide icons**
- **Cloud Firestore** so names, ratings and the shortlist are shared live between devices (with silent anonymous Firebase Auth behind it)
- **TMDB** for posters, search, MPAA ratings, runtimes and synopses
- Updates itself on every device when you deploy a new build

## What works with and without keys

| | No keys | TMDB key only | TMDB + Firebase |
| --- | --- | --- | --- |
| Movies | 150 built in, title cards instead of posters | Every movie, real posters | Every movie, real posters |
| People | Any number of names, on one device | Any number of names, on one device | The same names on every device |
| Ratings | Saved in that browser | Saved in that browser | Synced live to everyone |

The app ships with no ratings. Everything starts empty.

```bash
npm install
npm run dev        # http://localhost:5173
```

## Go live: keys and setup

Copy the template, then fill it in as you go:

```bash
cp .env.example .env.local
```

### 1. TMDB key (about 2 minutes)

1. Create a free account at https://www.themoviedb.org/signup.
2. Go to **Settings → API** (https://www.themoviedb.org/settings/api) and request an API key. Choose "Developer", personal use.
3. Copy the **API Key** (the short one) into `VITE_TMDB_API_KEY`. The long "API Read Access Token" also works.

With only this key set you get real posters and every movie, but names and ratings still live on one device.

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

### 3. Turn on anonymous sign-in

Nobody signs in by hand. The app quietly gives each device an anonymous session so the database only talks to the app.

1. In the Firebase console: **Build → Authentication → Get started**.
2. **Sign-in method → Anonymous → Enable → Save**.

### 4. Create the database and lock it down

1. **Build → Firestore Database → Create database**. Choose **Production mode** and any region near you.
2. Open the **Rules** tab, paste the contents of [`firestore.rules`](./firestore.rules), and click **Publish**.

Those rules let the app (and only the app) read and write the shared data. There are no personal accounts, so anyone who can open your site can pick any name and change ratings. Share the link only with people you trust.

### 5. Start it

```bash
npm run dev
```

Restart the dev server after editing `.env.local`. Open the site, type your name, and send the link to the people you watch with. Each of them types their name once; after that every device shows the same list of names to pick from.

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

### People

There are no accounts, roles or passwords. The first time someone opens the site they type their name. After that the site opens with a list of names to pick from, and each device remembers who used it last. Tap the avatars in the top right to switch person, add a name, or remove one.

Everyone who opens the site shares one space: the same names, ratings and shortlist.

### Tabs

- **Tonight** — pick who's watching and see suggestions ranked for exactly those people. Two ways to steer it:
  - **In the mood for:** tap one or more genres. Matching movies get a big boost; nothing is hidden.
  - **Movies like…:** type one or more reference movies. The list becomes movies similar to them, ranked for the people present, with everyone's vetoes still applied.

  Put movies on the shared shortlist with **+**, then choose together or **Spin**. Filters (MPAA rating, genre, runtime) are behind the Filters button.
- **Rate** — two modes, switched at the top:
  - **Quick Swipe:** one poster at a time, the top 5, 10 or 20 movies of each year, newest first. The setup bar combines **categories** and **eras** (Recent, 2020s … 1970s, Before 1970), so you can work through just 1990s sci-fi and comedy, for example. It skips what you've rated and remembers where you stopped.
  - **Rank 5:** five well-known movies from very different genres and decades. Kick out any you haven't seen (each is swapped for a fresh one), order the rest best to worst with the arrows, and submit. Then **Next batch**.
- **Search** — find one specific movie.
- **Mine** — your ratings, plus a summary of your taste by category.

### Ratings

| | Choice | Stored as | Stars |
| --- | --- | --- | --- |
| Watched it | **Watched** | `seen` | Required, 0.5–5 in half steps |
| Watched it | **Watch again** | `again` | Required, 0.5–5 |
| Haven't watched it | **Want to** | `unseen` | None |
| Haven't watched it | **Don't care** | `meh` | None |
| Haven't watched it | **No thanks** | `pass` | None |

### Taste and suggestions (`src/lib/suggest.js`)

**Taste.** For each person the app averages their stars per category, pulled toward their overall average until a category has a few ratings. For a movie they haven't rated it predicts their stars from those category scores, blended with the TMDB audience score. The more they rate, the more weight their own taste gets (up to 70% after 30 ratings).

**Suggestions for who's here.** A movie is suggested when:

1. nobody present ruled it out (a No thanks, or 1–2 stars without Watch again), and
2. at least one person present marked it Want to or Watch again.

Each present person then contributes a score out of 100: Want to 92, Watch again 20 per star, Don't care 55, watched without wanting a rewatch 10 per star, and for anyone who hasn't rated it, their predicted stars (discounted 15% for being a guess). The match % is 70% the group average plus 30% the least-keen person's score, so a pick everyone is fine with beats one that one person loves and another shrugs at.

People who aren't watching tonight don't count, including their vetoes.

**In the mood for.** Each priority genre a movie matches adds to its score: +15 for the first, +5 for each further one, up to +25. It changes the order, never what's shown.

**Movies like….** For each reference movie the app pulls four lists from TMDB: its recommendations, well-known movies sharing all its genres, well-known movies sharing its lead genre and any of its keywords, and its "similar" list. Each movie gets a similarity from 0 to 1; appearing in several lists, or being similar to several reference movies, raises it, and obscure titles are discounted. The list then shows only those similar movies, scored 65% group score and 35% similarity. Rule 2 above is dropped (nobody needs to have asked for them), rule 1 still applies, and a movie everyone present has already watched is left out.

**Rank 5 → stars.** A submitted ranking is saved as ordinary star ratings: 5, 4.5, 3.5, 3, 2.5 from top to bottom (5, 4, 3.5, 2.5 for four). Last place is 2.5 on purpose, above the 2-star veto line. Tapping **Never again** on a movie saves 1.5 instead, which does rule it out. These feed "Your taste so far" like any other rating and can be edited under Mine.

`npm test` checks these rules.

**"Top of each year"** means the most-rated releases of that year on TMDB. Every MPAA rating is included; use the Filters button on Tonight to narrow by rating.

## Database schema (Firestore)

```
groups/family                         ← the one shared space for this site
  members: {
    "k3x9q2ab": { name: "Couper", joinedAt: timestamp },
    "p7m1zz0c": { name: "Henry",  joinedAt: timestamp }
  }
  shortlist: [ { …movie }, { …movie } ]   // tonight's shortlist, shared

groups/family/movies/{tmdbId}         ← one document per movie anyone has rated
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
    "k3x9q2ab": { status: "again",  stars: 5    },
    "p7m1zz0c": { status: "unseen", stars: null }   // a missing id = hasn't rated it
    // ratings saved from Rank 5 also carry  via: "rank"
    // status is one of: seen | again | unseen | meh | pass
  }
  updatedAt: timestamp
```

Keeping everyone's ratings on one movie document means suggestions come from a single realtime listener, and a copy of the movie details is stored so the lists never need to call TMDB.

## Project layout

```
src/
  App.jsx                   pick-your-name front door, tabs
  index.css                 theme tokens and animations
  lib/
    config.js               reads .env, small on-device preferences
    firebase.js             Firebase setup and the silent anonymous session
    store.js                on-device store and shared store, same interface
    tmdb.js                 top-of-year decks, eras, similar movies, varied picks, search, details
    suggest.js              taste profiles and suggestions (pure functions)
    autoUpdate.js           checks for a newer build and reloads into it
    demoData.js             the built-in movie list (no ratings)
  components/
    Tonight.jsx             who's watching, mood and movies-like steering, shortlist, Spin, suggestions
    Rate.jsx                mode switch and Quick Swipe (poster by poster, categories + eras)
    Rank.jsx                Rank 5: kick the unseen, order the rest, submit
    Browse.jsx              search
    Mine.jsx                your ratings and taste summary
    RateSheet.jsx           movie details and rating sheet
    Group.jsx               names, switch person, settings
    ui.jsx                  posters, stars, status stubs, avatars, rows
firestore.rules             security rules to paste into Firebase
vercel.json / firebase.json hosting config for either deploy route
public/                     home-screen icons and web app manifest
.env.example                key template
tests/suggest.test.mjs      rule checks
```

## Troubleshooting

- **Names don't show up on another device after adding keys:** all four `VITE_FIREBASE_*` values must be set and `VITE_DEMO_MODE` must not be `true`. Locally, restart the dev server. On Vercel, add them under Settings → Environment Variables and redeploy; keys only take effect on a new build.
- **No posters:** `VITE_TMDB_API_KEY` is missing from the build. Same fix as above.
- **"The database refused access":** the rules from step 4 have not been published.
- **An update isn't showing up:** check the build time at the bottom of the page. If it is old, close and reopen the app once; if your host isn't Vercel or Firebase, make sure it doesn't cache `index.html` or `version.json`.
- **"Anonymous sign-in is switched off":** do step 3.
- **No MPAA rating or runtime on a movie in Rate or Search:** TMDB list results do not include them. They load when you open or rate the movie.

This product uses the TMDB API but is not endorsed or certified by TMDB.
