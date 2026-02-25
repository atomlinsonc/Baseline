# Baseline

**A read-only daily debate dashboard.** One topic per day, selected automatically by divisiveness signal, grounded in real polling data and fact-checked arguments.

→ [Live site](#) · [Backend API](#)

---

## What it does

Baseline publishes **one new debate topic every morning at 6 AM Eastern**. Each topic is a snapshot — published once with a date stamp and never updated.

Each topic page includes:
- **Why it's trending** — where the conversation is happening and what triggered it
- **Polling data** — top-line numbers plus demographic breakdowns by party, age, and gender
- **Argument tree** — the strongest claims on each side, each individually fact-checked against PolitiFact, FactCheck.org, AP Fact Check, Reuters, and Snopes

No comments. No accounts. No ads. Read-only reference tool.

---

## Tech stack

| Layer | Technology | Notes |
|---|---|---|
| Backend API | Node.js + Express | REST API, rate-limited |
| Database | SQLite (better-sqlite3) | Simple, zero-config, file-based |
| Scheduler | node-cron | Runs daily pipeline at 6 AM ET |
| AI analysis | OpenAI GPT-4o | Topic selection + claim tree + polling |
| Scrapers | Axios + Cheerio + RSS Parser | Reddit, Google Trends, YouTube |
| Frontend | React + Vite | Static, deployable to GitHub Pages |
| Deployment | Render (backend) + GitHub Pages (frontend) | Free tiers |

---

## Setup

### Prerequisites
- Node.js 18+
- An OpenAI API key (required for topic analysis)
- Optional but recommended: Reddit API credentials, SerpAPI key, YouTube Data API key

### 1. Clone and install

```bash
git clone https://github.com/yourusername/baseline.git
cd baseline
npm run install:all
```

### 2. Configure environment variables

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in your API keys. **At minimum, you need `OPENAI_API_KEY`.**

```env
# Required
OPENAI_API_KEY=sk-...

# Recommended (improves scraping quality)
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_secret
REDDIT_USER_AGENT=Baseline/1.0 (by /u/your_username)

# Optional (adds Google Trends data)
SERPAPI_KEY=your_serpapi_key

# Optional (adds YouTube News signals)
YOUTUBE_API_KEY=your_youtube_key

# Admin API protection (set any secret string)
ADMIN_SECRET=your_admin_secret_here
```

**Getting API keys:**
- **OpenAI**: https://platform.openai.com/api-keys
- **Reddit**: https://www.reddit.com/prefs/apps → create "script" app
- **SerpAPI**: https://serpapi.com (100 free searches/month — enough for daily use)
- **YouTube**: https://console.cloud.google.com → APIs → YouTube Data API v3 (10k free units/day)

### 3. Seed the database (for development)

This inserts a sample topic so the frontend works without running the full AI pipeline:

```bash
npm run seed
```

### 4. Start development servers

In two terminals:

```bash
# Terminal 1 — backend API on port 3001
npm run dev:backend

# Terminal 2 — frontend on port 5173
npm run dev:frontend
```

Open http://localhost:5173

---

## Running the daily pipeline

### Automatic (cron)
The backend automatically runs the pipeline every day at 6 AM Eastern (11:00 UTC) when the server is running.

### Manual trigger via command line
```bash
npm run run-daily
```

### Manual trigger via API
```bash
curl -X POST http://localhost:3001/api/admin/run-daily \
  -H "Authorization: Bearer your_admin_secret_here"
```

### Check pipeline status
```bash
curl http://localhost:3001/api/admin/run-log \
  -H "Authorization: Bearer your_admin_secret_here"
```

---

## How topic selection works

The daily pipeline runs in three phases:

**Phase 1: Scraping (parallel)**
- **Reddit** — Pulls hot posts from 10 political/news subreddits. Scores each post for divisiveness using upvote ratio bimodality (posts with ~50% upvote ratio + high comment volume = most polarizing). Clusters similar posts.
- **Google Trends** — Pulls US trending searches via SerpAPI or the public RSS feed. Filters out entertainment/sports noise.
- **YouTube** — Pulls trending News & Politics videos. Uses comment-to-view ratio as a divisiveness proxy.

**Phase 2: Topic selection (GPT-4o)**
- Merges signals from all three sources into a composite divisiveness score
- GPT-4o selects the single best topic that is: genuinely divisive, policy/society-focused (not entertainment), has sufficient polling data available, and hasn't been covered recently

**Phase 3: Content generation**
- GPT-4o generates argument tree (3 pro + 3 con arguments, each with 2-3 sub-claims)
- Each sub-claim is matched against live fact-checker RSS feeds (PolitiFact, FactCheck.org, AP, Reuters, Snopes)
- GPT-4o assigns a verdict to each claim: Supported / Mostly Supported / Contested / Mostly Unsupported / Unsupported / Unverifiable
- Polling data is scraped from FiveThirtyEight (GitHub CSV), Pew Research RSS, and RealClearPolitics, then structured by GPT-4o

---

## Deployment

### Backend → Render (free tier)

1. Create a free account at https://render.com
2. New → Web Service → connect your GitHub repo
3. Settings:
   - **Root directory**: `backend`
   - **Build command**: `npm install`
   - **Start command**: `node src/index.js`
   - **Environment**: Node
4. Add environment variables from `backend/.env`
5. **Persistent disk**: Add a 1GB disk mounted at `/app/data` — this is where the SQLite database lives. Without this, data resets on each deploy.

### Frontend → GitHub Pages

1. In `frontend/vite.config.js`, set `base` to your repo name if deploying to `username.github.io/baseline`:
   ```js
   base: '/baseline/',
   ```
2. In `frontend/package.json`, update the build script with your Render backend URL:
   ```json
   "build:gh-pages": "VITE_API_URL=https://your-app.onrender.com/api vite build"
   ```
3. Build and deploy:
   ```bash
   npm run build --prefix frontend
   # Then push the dist/ folder to your gh-pages branch
   ```
4. GitHub Action for automatic deploys (optional): see `.github/workflows/` if you add one.

**CORS**: Add your GitHub Pages URL to `ALLOWED_ORIGINS` in your Render environment variables:
```
ALLOWED_ORIGINS=https://yourusername.github.io
```

---

## API reference

All endpoints are read-only (GET) except the admin trigger.

| Endpoint | Description |
|---|---|
| `GET /health` | Health check |
| `GET /api/topics` | List all topics (paginated, searchable) |
| `GET /api/topics?q=keyword` | Search by keyword |
| `GET /api/topics?category=economic-policy` | Filter by category |
| `GET /api/topics?page=2&limit=20` | Pagination |
| `GET /api/topics/today` | Today's topic (full data) |
| `GET /api/topics/:slug` | Topic by slug (full data) |
| `GET /api/topics/categories` | All category definitions |
| `POST /api/admin/run-daily` | Trigger pipeline (requires Authorization header) |
| `GET /api/admin/run-log` | Recent pipeline runs (requires Authorization header) |
| `GET /api/admin/health` | Detailed system health (requires Authorization header) |

---

## Project structure

```
baseline/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.js        # SQLite schema + initialization
│   │   │   ├── queries.js       # All DB read/write functions
│   │   │   └── seed.js          # Dev seed data
│   │   ├── scrapers/
│   │   │   ├── redditScraper.js        # Reddit divisiveness signals
│   │   │   ├── googleTrendsScraper.js  # Google Trends (SerpAPI + RSS)
│   │   │   ├── youtubeScraper.js       # YouTube trending politics
│   │   │   └── pollingScraper.js       # FiveThirtyEight, Pew, RCP
│   │   ├── processors/
│   │   │   ├── topicSelector.js        # Cross-platform signal merging + GPT-4o selection
│   │   │   ├── claimTreeBuilder.js     # Argument generation + fact-checking
│   │   │   ├── pollingProcessor.js     # Poll structuring + demographics
│   │   │   └── topicBuilder.js         # Orchestrator — writes everything to DB
│   │   ├── routes/
│   │   │   ├── topics.js        # Public API routes
│   │   │   └── admin.js         # Protected admin routes
│   │   ├── scheduler/
│   │   │   └── runDaily.js      # Daily pipeline (also runnable directly)
│   │   ├── utils/
│   │   │   ├── logger.js        # Winston logger
│   │   │   └── slugify.js       # URL slug generation
│   │   └── index.js             # Express server + cron setup
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx/.css      # Header + footer shell
│   │   │   ├── TopicCard.jsx/.css   # Archive list card + featured hero card
│   │   │   ├── PollingChart.jsx/.css # Interactive polling visualization
│   │   │   ├── ClaimTree.jsx/.css   # Argument tree + fact-check verdicts
│   │   │   └── SearchBar.jsx/.css   # Keyword search input
│   │   ├── pages/
│   │   │   ├── HomePage.jsx/.css    # Today's topic + recent archive
│   │   │   ├── TopicPage.jsx/.css   # Full topic detail page
│   │   │   ├── ArchivePage.jsx/.css # Search + filter archive
│   │   │   └── NotFoundPage.jsx     # 404
│   │   ├── hooks/
│   │   │   └── useFetch.js          # Data fetching hook
│   │   ├── utils/
│   │   │   ├── api.js               # API client
│   │   │   └── format.js            # Date, number, verdict formatting
│   │   ├── styles/
│   │   │   └── global.css           # Design tokens + reset
│   │   ├── App.jsx                  # Router setup
│   │   └── main.jsx                 # Entry point
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── .gitignore
├── package.json                     # Root convenience scripts
└── README.md
```

---

## Maintenance

### Adding new scrapers
Each scraper is a standalone module in `backend/src/scrapers/`. To add a new source:
1. Create `backend/src/scrapers/newSourceScraper.js`
2. Export an async function that returns an array of `{ title, divisiveness_score, source }` objects
3. Import and call it in `backend/src/scheduler/runDaily.js` alongside the existing scrapers

### Updating fact-checker feeds
The list of fact-checker RSS feeds is in `backend/src/processors/claimTreeBuilder.js` in the `FACT_CHECKERS` array. Add or remove entries there.

### Changing the schedule
The cron expression is in `backend/src/index.js`:
```js
cron.schedule('0 11 * * *', ...)  // 11:00 UTC = 6:00 AM Eastern
```

### Backfilling topics
To manually add a topic for a past date, run:
```bash
node backend/src/scheduler/runDaily.js
```
Then modify the `date` variable in `runDaily.js` to the desired past date before running.

### Database backup
The SQLite database is a single file at `backend/data/baseline.db`. Back it up by copying this file.

---

## Cost estimates (monthly)

| Service | Free tier | Paid if exceeded |
|---|---|---|
| Render (backend) | 750 hrs/month (one service = free) | $7/mo starter |
| GitHub Pages (frontend) | Free | Free |
| OpenAI GPT-4o | ~$0.15/topic (input + output tokens) | ~$4.50/month for daily use |
| SerpAPI | 100 requests/month free | $50/mo for more |
| YouTube Data API | 10,000 units/day free | Rarely exceeded |
| Reddit API | Free with credentials | Free |

**Estimated monthly cost for daily use: ~$5–10/month** (primarily OpenAI tokens).

---

## License

MIT
