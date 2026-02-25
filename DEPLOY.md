# Deploying Baseline

Two services, both free tier:
- **Frontend** → GitHub Pages (auto-deploys on every push to `main`)
- **Backend** → Render (API + daily cron job + persistent SQLite disk)

---

## Step 1 — Push to GitHub

```bash
cd /Users/austintomlinson/Projects/Baseline
git add .
git commit -m "Initial Baseline build"
git push -u origin main
```

---

## Step 2 — Deploy Backend to Render

1. Go to **https://render.com** → sign up / log in with GitHub
2. Click **New** → **Blueprint**
3. Connect your `baseline` GitHub repo → Render will detect `render.yaml` automatically
4. It will show you two services to create:
   - `baseline-api` (Web Service)
   - `baseline-daily-pipeline` (Cron Job)
5. Click **Apply** — Render will ask you to fill in your secret env vars:

| Variable | Value |
|---|---|
| `OPENAI_API_KEY` | Your OpenAI key — **required** |
| `REDDIT_CLIENT_ID` | Optional but recommended |
| `REDDIT_CLIENT_SECRET` | Optional but recommended |
| `SERPAPI_KEY` | Optional |
| `YOUTUBE_API_KEY` | Optional |
| `ADMIN_SECRET` | Any secret string you choose |
| `ALLOWED_ORIGINS` | `https://atomlinsonc.github.io` |

6. After deploy, copy your backend URL — it will look like:
   `https://baseline-api.onrender.com`

7. **Seed the first topic** (otherwise the site will be empty):
   ```bash
   curl -X POST https://baseline-api.onrender.com/api/admin/run-daily \
     -H "Authorization: Bearer YOUR_ADMIN_SECRET"
   ```
   Or from your local terminal to run the full AI pipeline:
   ```bash
   cd backend
   OPENAI_API_KEY=sk-... node src/scheduler/runDaily.js
   ```

---

## Step 3 — Configure GitHub Pages

### 3a. Enable GitHub Pages in your repo settings

1. Go to `github.com/atomlinsonc/baseline` → **Settings** → **Pages**
2. Under **Source**, select **GitHub Actions**
3. Save

### 3b. Add your secrets to GitHub

Go to **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret name | Value |
|---|---|
| `VITE_API_URL` | `https://baseline-api.onrender.com/api` |
| `VITE_BASE_PATH` | `/baseline/` ← note the slashes (matches your repo name) |

### 3c. Trigger the first deploy

The workflow runs automatically on every push to `main`. To trigger it manually:
- Go to **Actions** tab → **Deploy Frontend to GitHub Pages** → **Run workflow**

Your site will be live at:
**`https://atomlinsonc.github.io/baseline/`**

---

## How the daily topic works on Render

The `render.yaml` creates a **Render Cron Job** that runs every day at 6 AM Eastern (11:00 UTC). It runs `node src/scheduler/runDaily.js` directly — this:
1. Scrapes Reddit, Google Trends, and YouTube for divisive trending topics
2. Uses GPT-4o to select the best topic and generate the argument tree
3. Scrapes and structures polling data
4. Writes everything to the SQLite database on the persistent disk
5. The frontend fetches from the API and shows the new topic

**You don't need to do anything** — it runs automatically every day as long as Render is running.

---

## Updating the site

Any push to `main` that touches `frontend/` automatically rebuilds and redeploys the frontend via GitHub Actions.

Backend changes redeploy on Render automatically when you push to `main` (Render watches your repo).

---

## Costs

| Service | Plan | Cost |
|---|---|---|
| GitHub Pages | Free | $0 |
| Render Web Service | Free | $0 |
| Render Cron Job | Free | $0 |
| Render Disk (1GB) | Free | $0 |
| OpenAI GPT-4o | ~$0.15/topic | ~$4.50/month |
| **Total** | | **~$4–5/month** |
