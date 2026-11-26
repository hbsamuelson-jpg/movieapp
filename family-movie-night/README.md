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

### 3. Turn on sign-in

1. In the Firebase console: **Authentication → Get started → Sign-in method**.
2. Enable **Anonymous**. This is what lets people use the app with just a name: each device gets a quiet session so the database only talks to the app.
3. Enable **Google** (optional). This lets someone link their name to a Google account.
4. For Google sign-in, go to **Authentication → Settings → Authorized domains** and add your site's address (for example `movieapp-chi-roan.vercel.app`).

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

## Critic scores (optional)

The app gets critic scores through OMDb, which needs its own free key:

1. Go to https://www.omdbapi.com/apikey.aspx, choose the free key, enter an email, and click the activation link they send.
2. In Vercel → Settings → Environment Variables, add `VITE_OMDB_API_KEY` with that key. Like the TMDB key, this one is read by the browser, so choose **Config** if Vercel asks.
3. Redeploy.

**What you actually get.** Rotten Tomatoes has no public API, and OMDb, which used to relay the Tomatometer, currently returns a **Metacritic** score for most movies and no Rotten Tomatoes score (checked November 2026 against several well-known titles). So in practice the badge reads **Metacritic 82**. The app still asks for both and will show **Rotten Tomatoes 97%** for any movie OMDb does supply one for. With no key, or no critic score at all, it shows the TMDB audience score, labelled **TMDB 78%**.

The free OMDb key allows a limited number of lookups per day (1,000 at the time of writing). The app keeps that low: each answer is cached on the device, and saved with the movie once anyone rates it. If the limit is hit, new movies fall back to TMDB scores until the next day.

## The AI assistant (optional)

The **Ask** tab is a chat that knows what everyone watching has rated, wants, and has ruled out. Its suggestions can go straight onto the shortlist.

It needs one more key, and this one is a real secret:

1. Create an API key at https://console.anthropic.com (Settings → API keys). This is billed per use and is separate from any Claude subscription. Add a little credit under Billing.
2. In Vercel → Settings → Environment Variables, add `ANTHROPIC_API_KEY` with that key. **Leave it as Secret** and do not give it a `VITE_` prefix; the prefix would publish it in the site's code.
3. Redeploy.

Optional settings, same place: `AI_MODEL` (default `claude-haiku-5-5`, the cheapest; `claude-sonnet-5-5` gives richer answers for more money) and `AI_DAILY_CAP` (default `60` questions a day for the whole group).

How it stays safe:

- The key lives only in `api/assistant.js`, a private function Vercel runs on its servers. The browser never sees it.
- The function only answers a device with a valid session from this site's Firebase project, and only for a name that exists in the group.
- A daily question cap is counted on the group document (`ai: { day, count }`).
- The AI's suggestions are looked up on TMDB before they're shown, so a made-up title drops out, and anything someone watching has ruled out is removed regardless of what the AI said.

What the AI is sent: the first names of the people watching, their favourite genres, and the titles they love, want, or have ruled out, plus the question. Nothing else.

## How it works

### People

There are no roles. The first time someone opens the site they type their name. After that the site opens with a list of names to pick from, and each device remembers who used it last. Tap the avatars in the top right to switch person, add a name, or remove one.

**Google sign-in is optional.** Anyone can link their existing name to a Google account, either from the avatar page ("Link my Google account") or by signing in with Google on the front page and tapping their name. Nothing is copied or moved: ratings are stored under the name's id, so they stay exactly as they were. Once linked, signing in with Google on any device opens straight into that name, and the name can no longer be picked without signing in. Names that aren't linked keep working as before.

Everyone who opens the site shares one space: the same names, ratings and shortlist.

### Tabs

- **Ask** — the AI assistant (see above). Shares the who's-watching selection with Tonight.
- **Tonight** — pick who's watching. The list holds only two kinds of movie, ranked for exactly those people:
  - **Wanted:** movies someone watching marked Want to or Watch again. These come first.
  - **New to us:** movies nobody watching has seen that fit the group's interests: similar to their favourites and most-loved movies, or by a director or writer they keep liking. Each says why it's there ("like Knives Out", "directed by Hayao Miyazaki").

  Two ways to steer it:
  - **In the mood for:** tap one or more genres. Matching movies get a big boost; nothing is hidden.
  - **Movies like…:** type one or more reference movies. The list becomes movies similar to them, with everyone's vetoes still applied.

  Put movies on the shared shortlist with **+**, then choose together, **Spin**, or hold a **Secret vote** (below). Filters (MPAA rating, genre, runtime) are behind the Filters button.
- **Rate** — two modes, switched at the top:
  - **Quick Swipe:** one poster at a time, the top 5, 10 or 20 movies of each year, newest first. The setup bar combines **categories** and **eras** (Recent, 2020s … 1970s, Before 1970), so you can work through just 1990s sci-fi and comedy, for example. It skips what you've rated and remembers where you stopped.
  - **Rank 5:** five well-known movies from very different genres and decades. Kick out any you haven't seen (each is swapped for a fresh one), order the rest best to worst with the arrows, and submit. Then **Next batch**. No stars are assigned; it only teaches the app your taste.
- **Search** — find one specific movie, or switch to **Directors** to look up a director or writer and browse everything they made.
- **Mine** — your profile: up to ten **all-time favourites**, a summary of your taste by category, the directors and writers you keep liking, and everything you've rated.

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

**Secret vote.** With two or more movies on the shortlist, anyone can start a vote. Everyone marked as watching gets a ballot on their own device (a red dot appears on the Tonight tab) and picks one movie. Totals stay hidden until everyone has voted or someone taps "End vote now"; then the winner and the counts show for everybody. A tie offers "Spin the tie". Votes can be changed until the result shows.

It is anonymous by construction: the app stores who has voted and how many votes each movie has as two separate things, updated together, so nothing saved says who chose what. Each device remembers its own choice only so that person can change it.

**Favourites.** An all-time favourite is stored on the person and recorded as watched-and-loved (no stars). It counts double in their taste profile, and the Tonight list looks for movies like it. Adding one never overwrites a rating you gave yourself.

**Review scores.** A movie's score is its Rotten Tomatoes critics score when the app has one, otherwise its Metacritic score, otherwise the TMDB audience score. Tonight's ranking gives well-reviewed movies a small nudge: up to 4 points either way, centred on a score of 65. It breaks near-ties; it does not outweigh what people actually want.

**Directors and writers.** Movie details include the director(s) and up to two writers. For each person the app tracks who is behind the movies they rated 4 or higher; anyone who shows up twice (or once on an all-time favourite) becomes a "keeps liking" name. A movie by one of them gets half a star added to that person's predicted rating, and their other well-known movies are pulled into Tonight's new-to-us list. Movies rated before this existed get their credits filled in quietly in the background.

**What Tonight shows.** A movie makes the list only if nobody present ruled it out (a No thanks, or 1–2 stars without Watch again) and it is either:

1. **wanted** — at least one person present marked it Want to or Watch again, or
2. **new** — no one present has any answer for it, and it came from the discovery pool: movies similar to up to three favourites or top-rated movies per person, plus other movies by their liked directors and writers.

Movies people have simply watched no longer appear.

Each present person then contributes a score out of 100: Want to 92, Watch again 20 per star, Don't care 55, watched without wanting a rewatch 10 per star, and for anyone who hasn't rated it, their predicted stars (discounted 15% for being a guess). The match % is 70% the group average plus 30% the least-keen person's score, so a pick everyone is fine with beats one that one person loves and another shrugs at. New movies are scored 75% on that group score and 25% on how closely they match the group's interests, and always sit below the wanted ones.

People who aren't watching tonight don't count, including their vetoes.

**In the mood for.** Each priority genre a movie matches adds to its score: +15 for the first, +5 for each further one, up to +25. It changes the order, never what's shown.

**Movies like….** For each reference movie the app pulls four lists from TMDB: its recommendations, well-known movies sharing all its genres, well-known movies sharing its lead genre and any of its keywords, and its "similar" list. Each movie gets a similarity from 0 to 1; appearing in several lists, or being similar to several reference movies, raises it, and obscure titles are discounted. The list then shows only those similar movies, scored 65% group score and 35% similarity. Rule 2 above is dropped (nobody needs to have asked for them), rule 1 still applies, and a movie everyone present has already watched is left out.

**Rank 5 → taste, not stars.** A submitted ranking does not give any movie a star rating. Each movie is saved as "watched" with a hidden taste signal on the same 0–5 scale the taste profile uses: 5, 4.5, 3.5, 3, 2.5 from top to bottom. That number is never displayed; ranked movies show as "Watched · ranked". It feeds "Your taste so far" and the predictions exactly as a star rating would. Last place is 2.5 on purpose, above the veto line. Tapping **Never again** saves 1.5 instead, which does rule the movie out. Opening a ranked movie and giving it stars replaces the ranking with a normal rating.

`npm test` checks these rules.

**"Top of each year"** means the most-rated releases of that year on TMDB. Every MPAA rating is included; use the Filters button on Tonight to narrow by rating.

## Database schema (Firestore)

```
groups/family                         ← the one shared space for this site
  members: {
    "k3x9q2ab": { name: "Couper", joinedAt: timestamp, uid: "<Google uid>",   // uid only if linked
                  favorites: [ { …movie }, … ] },                              // all-time favourites
    "p7m1zz0c": { name: "Henry",  joinedAt: timestamp }
  }
  shortlist: [ { …movie }, { …movie } ]   // tonight's shortlist, shared
  ai: { day: "2026-11-26", count: 7 }     // assistant questions asked today
  vote: {                               // the current secret vote, if any
    id: "x1y2z3", open: true,
    options: [ { id, title, year, poster }, … ],
    voters: [ "k3x9q2ab", "p7m1zz0c" ],  // who gets a ballot
    voted:  [ "k3x9q2ab" ],              // who has cast one (not what they chose)
    tally:  { "105": 1 }                 // votes per movie id
  }

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
    crew: [ { id: 1, name: "Robert Zemeckis", role: "director" }, … ],  // director(s) + up to 2 writers
    imdb: "tt0088763",
    rt: null, mc: 88,                 // Rotten Tomatoes and Metacritic scores, 0–100 or null
    scored: 2,                        // critic-score lookup done (version number)
    detailed: true                    // runtime + cert have been fetched
  }
  ratings: {
    "k3x9q2ab": { status: "again",  stars: 5    },
    "p7m1zz0c": { status: "unseen", stars: null }   // a missing id = hasn't rated it
    // from Rank 5:  { status: "seen", stars: null, like: 4.5, via: "rank", place: 2, of: 5 }
    // a favourite:  { status: "seen", stars: null, like: 5, via: "favorite" }
    //   (like = hidden taste signal, never shown as stars)
    // status is one of: seen | again | unseen | meh | pass
  }
  updatedAt: timestamp
```

Keeping everyone's ratings on one movie document means suggestions come from a single realtime listener, and a copy of the movie details is stored so the lists never need to call TMDB.

## Project layout

```
api/
  assistant.js              private server function for the AI assistant (holds the secret key)
src/
  App.jsx                   pick-your-name front door, tabs
  index.css                 theme tokens and animations
  lib/
    config.js               reads .env, small on-device preferences
    firebase.js             Firebase setup, the quiet anonymous session, optional Google sign-in
    store.js                on-device store and shared store, same interface
    tmdb.js                 top-of-year decks, eras, similar movies, varied picks, search, details
    suggest.js              taste profiles and suggestions (pure functions)
    discover.js             finds unwatched movies that fit the group (favourites, loved movies, liked crew)
    assistant.js            summarises the group for the AI, resolves and vets its picks
    autoUpdate.js           checks for a newer build and reloads into it
    demoData.js             the built-in movie list (no ratings)
  components/
    Tonight.jsx             who's watching, mood and movies-like steering, shortlist, Spin, suggestions
    Rate.jsx                mode switch and Quick Swipe (poster by poster, categories + eras)
    Ask.jsx                 the assistant chat
    Vote.jsx                the secret vote panel and result
    Rank.jsx                Rank 5: kick the unseen, order the rest, submit
    Browse.jsx              search for movies, or for directors and writers
    Mine.jsx                your favourites, taste summary and ratings
    MoviePicker.jsx         type-a-title movie picker used for favourites and Movies like…
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
