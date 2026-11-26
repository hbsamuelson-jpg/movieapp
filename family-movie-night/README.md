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

  Ways to steer it:
  - **In the mood for:** tap one or more genres. Matching movies get a big boost; nothing is hidden.
  - **Time tonight:** Any length, 90 min, 2 hours or 2½ hours. Longer movies are hidden.
  - **Where to watch:** the app assumes you have every subscription service. Each movie says "on Disney+", "free on Tubi" or "rent only". **No rental needed** hides rent-or-buy-only movies; **Free only** keeps just the ones that are free to watch.
  - **Movies like…:** type one or more reference movies. The list becomes movies similar to them, with everyone's vetoes still applied.

  The list shows the top 20, with **Show more** underneath. Put movies on the shared shortlist with **+**, then choose together, **Spin**, or hold a **Secret vote** (below). Filters (MPAA rating, genre) are behind the Filters button.

  **History** (top right of Tonight) is the log of past movie nights: the movie, the date, how it was chosen (vote, spin or picked), who voted, and who watched. Tap **We're watching this** on a vote result or spin, or **We watched this** on any movie, to log a night. Afterwards each person can give the movie a score from the History page; the entry shows everyone's score and the average.
  **Ranked vote.** With three or more movies on the shortlist, the secret vote is ranked: each person taps their top 3 in order and casts. A first choice is worth 3 points, a second 2, a third 1, and the most points wins, which favours the movie everyone is fine with. With two movies it stays one vote each. Ties can be spun.

  **Not tonight.** On any movie's page, **Not tonight** hides it from your suggestions for 3 weeks without ruling it out. It applies whenever you're one of the people watching. Hidden movies are listed at the bottom of Tonight with **Bring back**.

  **Coming soon** (Search tab): movies opening in US theatres over the next five months, sorted by how well they fit your taste or by date. **Want to see** adds one to your Want to list; it stays off Tonight until its release date.

  **Month in review** (top of Stats): for any month since your first logged movie night: how many nights and hours, the most-watched genre, how movies were chosen, movie of the month, biggest letdown (only if it averaged under 3), the movie that split the room, the full list with scores, and how many each person watched. It's built from the movie-night log, since individual ratings aren't dated.

  **Stats** (top right of Tonight): how many movie nights and how they were chosen, the best and worst night by score, how closely each pair of people agree (100% = identical stars; each star apart costs 25 points; needs 4 movies both rated), the movie that split you most, family favourites (average 4+), and each person's count, average and top genre. Only star ratings count.

  **Score reminder.** Two hours after a movie night is logged, anyone who watched and hasn't scored it sees "How was …?" at the top of Tonight and a dot on History and the Tonight tab. The ✕ dismisses that reminder on that device.

- **Rate** — two modes, switched at the top:
  - **Quick Swipe:** one poster at a time, the top 5, 10 or 20 movies of each year, newest first. The setup bar combines **categories** and **eras** (Recent, 2020s … 1970s, Before 1970), so you can work through just 1990s sci-fi and comedy, for example. It skips what you've rated and remembers where you stopped.
  - **Rank 5:** five well-known movies from very different genres and decades. Kick out any you haven't seen (each is swapped for a fresh one), order the rest best to worst with the arrows, and submit. Then **Next batch**. No stars are assigned; it only teaches the app your taste.
- **Search** — find one specific movie, or switch to **Directors** to look up a director or writer and browse everything they made.
- **Mine** — your profile. At the top, **Movies you should like**: picks just for you that you haven't answered yet, drawn from movies like your favourites, directors and writers you keep liking, and movies someone else in the family rated 4 or higher. Each has **Want to watch** (adds it to your Want to list, so it shows up on Tonight), **Seen it** (opens the rating sheet) and an ✕ for No thanks. One director or favourite can't fill the list. Below that: up to ten **all-time favourites**, a summary of your taste by category, the directors and writers you keep liking, and everything you've rated.

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

**Movie page extras.** On a movie's page and on the Quick Swipe card: **Trailer** opens the official trailer on YouTube (or a YouTube search when TMDB has none), and **Common Sense Media** opens their search for the title, for age guidance. **Where to watch** shows, for the US: **Free** (free services, usually with ads, or free with a library card such as Kanopy and Hoopla), **Included with** (subscription services), or the stores that rent or sell it. The data comes from JustWatch through TMDB, is refreshed every two weeks and can lag. It says which services carry a movie but not what they charge, so there are no prices in the app; **Compare rental prices** opens JustWatch, which lists them. Service names are shown as text. Add-on channels are folded into the service ("AMC+ Amazon Channel" counts as AMC+).

**Best of all time.** At the top of Quick Swipe, **Rate the best of all time** opens a list of the top-rated movies ever, overall or in any one category (Action, Comedy, Horror…). It's the 60 highest TMDB audience scores among widely seen movies (at least 8,000 votes overall, 2,500 within a category, lower for small categories such as Documentary), best first, minus anything you've already rated. It works like any other Quick Swipe deck.

**Ask for a list to rate.** At the top of Quick Swipe, type what you want to rate, e.g. "5 good R comedies" or "top 10 action movies on Rotten Tomatoes", and tap **Get list**. The AI assistant names the movies, each is looked up on TMDB (anything made up drops out), movies you've already rated are left off, and the list replaces the year-by-year deck until you finish or close it. The list comes from the AI's own knowledge, not a live lookup, so a "top 10" can differ from a site's current ranking. Each list counts as one of the day's assistant questions (`AI_DAILY_CAP`). Live site only.

**Rank genres.** On Mine, **Rank genres** lets each person put the 14 genres in order, favourite first, by dragging a row by its grip or with the arrows. Nothing counts until the order is first changed. The top genre is treated as 5 stars, the bottom as 1, the rest evenly between; each counts like four movies of that genre rated that way, and a movie in a ranked genre is predicted at least half from that ranking right away. It never vetoes anything, and real ratings outweigh it as they pile up. Stored on the person as `genreRank: ["Comedy", "Sci-Fi", …]`.

**Favourite genres on Stats.** Each person's favourite genres (up to three) come from the same taste profile the suggestions use, which counts star ratings, Rank 5 results and all-time favourites. Someone who has only ranked movies still gets favourite genres; the line under their name shows how many they've rated and ranked.

**Rank 5.** Reorder by dragging a row by its poster (mouse or finger) or with the arrows. **Haven't seen** swaps the movie for another and saves it as "haven't seen", so Rank 5 never deals it to you again. That answer carries no opinion: the movie can still be suggested, still shows up in Quick Swipe for a Want to / Don't care / No thanks answer, and is listed under Haven't seen on Mine.

**Number keys.** On a computer, on the Quick Swipe card and on a movie's page: **1–5** sets that many stars, the **same key again** takes half a star off (4, 4 → 3½), **0** clears the stars. On Quick Swipe the arrow keys answer for movies you haven't watched: **←** Want to, **↓** Don't care, **→** No thanks (each saves and moves on; they're off once stars are set). **Delete** is undo: it takes back stars you just set, or with none set, goes back to the previous movie and removes its rating (same as the Undo button). **Enter** on Quick Swipe goes to the next movie: with 3 stars or more it saves the movie as "would watch again", with 2½ or fewer as plain watched, and with no stars it skips. **Shift** (tapped by itself, or Shift+Enter) saves the stars as plain watched, never "watch again", and moves on. On a movie's page, Enter saves what's selected. Keys are ignored while you're typing in a search box.

**Bigger, bolder text.** A switch under People and settings (tap the avatars, top right). It makes all text about 20% larger and heavier and is remembered per device.

**On a computer.** From about 1024px wide the app uses the whole window (up to 1700px). Tonight puts the controls and shortlist on the left and suggestions on the right, in two columns on wide windows. Mine goes to three columns on wide windows: picks, then favourites, taste and genres, then ratings. History and Search results use two columns.

**Quick Swipe fits the window.** The poster is sized from the window's height, on computers and phones, so the movie and every rating control are on screen without scrolling (very short screens, such as an iPhone SE, still scroll a little). On a computer the filter, Ask for a list, Best of all time and Undo share one row. On a phone, Ask for a list and Best of all time sit behind a **Lists** button, and the three greyed-out buttons step aside once stars are set.

**Rating sheet.** Once you give stars, the three "Haven't watched it" buttons grey out. Tapping one still works: it clears the stars and switches your answer.

**Database limits.** Firebase's free plan allows about 50,000 reads and 20,000 writes a day, and every phone re-reads a movie whenever anyone's phone rewrites it. The only background job that writes is the one that fills in movie details (credits, score, where to watch). It tries each movie at most once every 20 hours per device, refreshes availability every two to four weeks (staggered by movie), and writes only when a lookup found something new; an unchanged refresh is remembered on the device. Each device also keeps its own copy of the movie list (in the browser's storage) and, after one full read, asks the server only for movies changed since its last visit, with a full re-read once a week as a safety net; opening the app costs a handful of reads instead of one per rated movie. If the limit is ever hit, the app says so and recovers by itself around midnight Pacific. Switching the Firebase project to the Blaze (pay-as-you-go) plan removes the cap.

**Testing without the real database.** `npm run emulators` starts local Firebase emulators (needs Java); build with `VITE_EMULATOR=true` and any placeholder Firebase values to point the app at them. Nothing in that mode touches the real project or its daily limit.

**Title links.** On a movie's detail sheet and on the Quick Swipe card, the title opens Rotten Tomatoes in a new tab. It goes to their search results for that title (the movie is the top result), because nothing the app has access to gives a movie's exact Rotten Tomatoes address.

**Review scores.** A movie's score is its Rotten Tomatoes critics score when the app has one, otherwise its Metacritic score, otherwise the TMDB audience score. Tonight's ranking gives well-reviewed movies a small nudge: up to 4 points either way, centred on a score of 65. It breaks near-ties; it does not outweigh what people actually want.

**Directors and writers.** Movie details include the director(s) and up to two writers. For each person the app tracks who is behind the movies they rated 4 or higher; anyone who shows up twice (or once on an all-time favourite) becomes a "keeps liking" name. A movie by one of them gets half a star added to that person's predicted rating, and their other well-known movies are pulled into Tonight's new-to-us list. Movies rated before this existed get their credits filled in quietly in the background.

**What Tonight shows.** A movie makes the list only if nobody present ruled it out (a No thanks, or 1–2 stars without Watch again) and it is either:

1. **wanted** — at least one person present marked it Want to or Watch again, or
2. **new** — no one present has watched it or said no to it, and it came from the discovery pool: movies similar to up to three favourites or top-rated movies per person, plus other movies by their liked directors and writers.

Movies people have simply watched no longer appear.

**Already seen.** If anyone present has watched a movie and didn't ask to watch it again, it loses 30 points, which drops it below nearly everything nobody has seen. It only still shows because someone else present wants it.

Each present person then contributes a score out of 100: Want to 92, Watch again 20 per star, Don't care 55, watched without wanting a rewatch 10 per star, and for anyone who hasn't rated it, their predicted stars (discounted 15% for being a guess). The match % is 70% the group average plus 30% the least-keen person's score, so a pick everyone is fine with beats one that one person loves and another shrugs at. New movies are scored 75% on that group score and 25% on how closely they match the group's interests, and always sit below the wanted ones.

People who aren't watching tonight don't count, including their vetoes.

**Streaming lift.** A movie that can be streamed without renting gets +6. Movies whose streaming info hasn't been fetched yet count as rent-only when a Where to watch filter is on.

**In the mood for.** Each priority genre a movie matches adds to its score: +15 for the first, +5 for each further one, up to +25. It changes the order, never what's shown.

**Movies like….** For each reference movie the app looks for, strongest first: other movies in the same series, TMDB's recommendations, other movies by the same director, well-known movies sharing its themes (keywords), and TMDB's "similar" list. Sharing only a genre and decade never gets a movie in by itself; it can only strengthen one that qualified another way. Each movie gets a similarity from 0 to 1, raised when several signals agree or when it matches several reference movies, and each says why it's there ("same series as…", "from the director of…"). The list then shows only those movies, scored 65% group score and 35% similarity. Rule 2 above is dropped (nobody needs to have asked for them), rule 1 still applies, and a movie everyone present has already watched is left out. The same engine fills the new-to-us list from each person's favourites.

**Rank 5 → taste, not stars.** A submitted ranking does not give any movie a star rating. Each movie is saved as "watched" with a hidden taste signal on the same 0–5 scale the taste profile uses: 5, 4.5, 3.5, 3, 2.5 from top to bottom. That number is never displayed; ranked movies show as "Watched · ranked". It feeds "Your taste so far" and the predictions exactly as a star rating would. Last place is 2.5 on purpose, above the veto line. Tapping **Never again** saves 1.5 instead, which does rule the movie out. Opening a ranked movie and giving it stars replaces the ranking with a normal rating.

`npm test` checks these rules.

**"Top of each year"** means the most-rated releases of that year on TMDB. Every MPAA rating is included; use the Filters button on Tonight to narrow by rating.

## Database schema (Firestore)

```
groups/family                         ← the one shared space for this site
  members: {
    "k3x9q2ab": { name: "Couper", joinedAt: timestamp, uid: "<Google uid>",   // uid only if linked
                  favorites: [ { …movie }, … ],                                // all-time favourites
                  snoozed: { "105": 1797500000000 } },                         // "not tonight": movie id -> hidden until (ms)
    "p7m1zz0c": { name: "Henry",  joinedAt: timestamp }
  }
  shortlist: [ { …movie }, { …movie } ]   // tonight's shortlist, shared
  ai: { day: "2026-11-26", count: 7 }     // assistant questions asked today
  history: [                              // past movie nights, newest first
    { id: "h1a2b3c4", at: 1795700000000,  // when (ms)
      movie: { …movie },
      via: "vote",                        // vote | spin | pick
      voters:   [ "k3x9q2ab", "p7m1zz0c" ],   // who voted (never what they chose)
      watchers: [ "k3x9q2ab", "p7m1zz0c" ] }  // who watched
  ]                                       // scores live in the movie's ratings, below
  vote: {                               // the current secret vote, if any
    id: "x1y2z3", open: true,
    ranked: true,                        // 3+ movies: everyone ranks a top 3, worth 3 / 2 / 1 points
    options: [ { id, title, year, poster }, … ],
    voters: [ "k3x9q2ab", "p7m1zz0c" ],  // who gets a ballot
    voted:  [ "k3x9q2ab" ],              // who has cast one (not what they chose)
    tally:  { "105": 3 }                 // votes (or points, if ranked) per movie id
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
    release: "2017-11-22",            // release date; a wanted movie stays off Tonight until then
    scored: 2,                        // critic-score lookup done (version number)
    watch: { v: 2, at: 1795700000000,                       // US availability, and when it was checked
             on: [ { name: "Disney+" } ],                   // included with a subscription
             free: [ { name: "Tubi" } ],                    // free to watch
             rent: [ "Apple TV Store" ] },                  // stores that rent or sell it
    trailer: "Rvr68u6k5sI",           // YouTube id of the official trailer, or null
    detailed: true                    // runtime + cert have been fetched
  }
  ratings: {
    "k3x9q2ab": { status: "again",  stars: 5    },
    "p7m1zz0c": { status: "unseen", stars: null }   // a missing id = hasn't rated it
    // from Rank 5:  { status: "seen", stars: null, like: 4.5, via: "rank", place: 2, of: 5 }
    // a favourite:  { status: "seen", stars: null, like: 5, via: "favorite" }
    // logged from a movie night, not scored yet:  { status: "seen", stars: null, via: "watched" }
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
    stats.js                family stats and the "waiting for your score" list (pure functions)
    votes.js                vote point arithmetic
    discover.js             finds unwatched movies that fit the group (favourites, loved movies, liked crew)
    assistant.js            summarises the group for the AI, resolves and vets its picks
    autoUpdate.js           checks for a newer build and reloads into it
    demoData.js             the built-in movie list (no ratings)
  components/
    Tonight.jsx             who's watching, mood and movies-like steering, shortlist, Spin, suggestions
    History.jsx             past movie nights and after-the-movie scores
    Stats.jsx               family stats
    ForYou.jsx              "Movies you should like" on the Mine tab
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
