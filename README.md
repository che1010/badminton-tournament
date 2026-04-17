# 🏸 ShuttleScore — Badminton Tournament Manager

A multi-agent, real-time badminton tournament scoring and leaderboard web app. Built with vanilla HTML/CSS/JS, powered by the Claude AI API for intelligent scoring commentary and tally aggregation, with optional Firebase real-time sync for multi-device tournaments.

---

## Features

- **Multi-court scoring** — manage 5+ simultaneous matches from any device
- **BWF rules enforced** — rally point, 21pts, win by 2, deuce at 20–20, cap at 30, best of 3
- **AI Scoring Agent** — Claude provides live commentary and rule reminders after each point
- **AI Tally Agent** — Claude aggregates all match results into a ranked leaderboard
- **Real-time sync** — optional Firebase integration syncs scores across all recorders instantly
- **Export report** — download a full Excel (.xlsx) or CSV report with 3 data sheets
- **Offline fallback** — works fully without Firebase using localStorage
- **Mobile-friendly** — score from a phone on court

---

## Project Structure

```
badminton-tournament/
├── index.html              # Main HTML shell
├── src/
│   ├── css/
│   │   └── main.css        # All styles
│   └── js/
│       ├── state.js         # Shared app state + localStorage persistence
│       ├── firebase-sync.js # Optional Firebase Realtime Database sync
│       ├── scoring-agent.js # BWF rules engine + Claude commentary
│       ├── tally-agent.js   # Leaderboard aggregation via Claude
│       ├── export.js        # Excel + CSV report generation (SheetJS)
│       ├── ui.js            # All DOM rendering
│       └── app.js           # Entry point, tab routing, init
├── docs/
│   └── firebase-setup.md   # Step-by-step Firebase setup guide
└── README.md
```

---

## Quick Start (Local)

No build step required — just open in a browser.

```bash
git clone https://github.com/YOUR_USERNAME/badminton-tournament.git
cd badminton-tournament
# Open index.html in your browser
open index.html
```

Or serve with any static server:

```bash
npx serve .
# or
python3 -m http.server 8080
```

---

## Deploying to Netlify (Free Hosting)

1. Push this repo to GitHub
2. Go to [netlify.com](https://netlify.com) and sign up (free)
3. Click **Add new site → Import an existing project → GitHub**
4. Select your repository
5. Leave all build settings blank (no build command needed)
6. Click **Deploy site**

Your app will be live at a URL like `https://your-site-name.netlify.app` in ~60 seconds.

### Custom domain
In Netlify: **Domain settings → Add custom domain** — free with any domain you own.

---

## Deploying to GitHub Pages (Alternative Free Hosting)

1. Push repo to GitHub
2. Go to your repo → **Settings → Pages**
3. Under **Source**, select `main` branch and `/ (root)`
4. Click **Save**

Your app will be live at `https://YOUR_USERNAME.github.io/badminton-tournament/`

---

## Claude API Setup

The app calls the Anthropic Claude API directly from the browser for:
- **Scoring Agent**: post-point commentary (12 words, non-blocking)
- **Tally Agent**: leaderboard generation from match data

The Claude API key is handled automatically when the app is embedded in Claude.ai. For standalone deployment, you will need to add your own API key.

### Adding your API key for standalone use

In `src/js/scoring-agent.js` and `src/js/tally-agent.js`, update the fetch headers:

```js
const HEADERS = {
  'Content-Type': 'application/json',
  'x-api-key': 'sk-ant-YOUR_KEY_HERE',   // add this line
  'anthropic-version': '2023-06-01',       // add this line
  // remove: 'anthropic-dangerous-direct-browser-access': 'true'
};
```

> ⚠️ **Never commit your API key to a public repo.** Use environment variables or a backend proxy for production.

For a production setup, create a simple serverless function (Netlify Functions, Vercel Edge, Cloudflare Workers) that proxies requests to the Anthropic API with the key stored server-side.

---

## Firebase Real-Time Sync Setup

Firebase enables multiple recorders on different devices to share live match data.

### 1. Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → follow the prompts (no need to enable Google Analytics)

### 2. Enable Realtime Database

1. In your project: **Build → Realtime Database → Create database**
2. Choose a region (pick closest to your venue)
3. Start in **test mode** (you can add auth rules later)

### 3. Get your config

1. **Project settings** (gear icon) → **Your apps → Add app → Web**
2. Register the app (any nickname)
3. Copy the `firebaseConfig` object — it looks like:

```json
{
  "apiKey": "AIza...",
  "authDomain": "your-project.firebaseapp.com",
  "databaseURL": "https://your-project-default-rtdb.firebaseio.com",
  "projectId": "your-project",
  "storageBucket": "your-project.appspot.com",
  "messagingSenderId": "123456789",
  "appId": "1:123..."
}
```

### 4. Connect in the app

1. Open ShuttleScore → **Setup → Firebase Real-Time Sync**
2. Paste your config JSON
3. Click **Connect Firebase**

All devices at the tournament will now sync automatically.

---

## How the Multi-Agent System Works

```
Human recorder taps "+ Point"
        │
        ▼
┌─────────────────┐
│  Scoring Agent  │  — Enforces BWF rules, updates game/match state
│  (per court)    │  — Calls Claude for a 12-word commentary note
└────────┬────────┘
         │ match state
         ▼
  Firebase / localStorage
         │
         ▼
┌─────────────────┐
│  Tally Agent    │  — Reads all court states
│  (shared)       │  — Calls Claude to rank players
└────────┬────────┘
         │
         ▼
    Leaderboard
```

The **Scoring Agent** is deterministic for rules (pure JS) and uses AI only for optional commentary. If the AI call fails, scoring continues uninterrupted.

The **Tally Agent** uses AI to aggregate and rank. If the API is unavailable, it falls back to a local JavaScript tally calculation.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` | Courts view |
| `2` | Leaderboard |
| `3` | Export report |
| `4` | Agent log |
| `5` | Setup |

---

## Export Report Sheets

| Sheet | Contents |
|-------|----------|
| **Leaderboard** | Rankings, match wins/losses, game differential |
| **Match Results** | One row per match — court, format, teams, winner, timestamps |
| **Game Scores** | One row per game — exact scores, deuce flag, total points |

---

## BWF Scoring Rules Reference

| Rule | Detail |
|------|--------|
| Scoring system | Rally point — every rally wins a point |
| Game length | First to 21 points |
| Win condition | Must lead by 2 points |
| Deuce | At 20–20, play continues until 2-point lead |
| Point cap | Game ends at 30–29 |
| Match format | Best of 3 games |
| Service | Winner of each rally serves next |

---

## License

MIT — free to use, modify, and deploy.
