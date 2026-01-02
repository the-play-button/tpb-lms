# LMS Execution Scripts

Learning Management System infrastructure built on Cloudflare (Stream, D1, Workers).

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Pages)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ SOM Viewer   │  │ Stream Player│  │ Gamification UI      │  │
│  │ (index.html) │  │ (native+JS)  │  │ (XP, badges, board)  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
└─────────┼─────────────────┼─────────────────────┼──────────────┘
          │                 │                     │
          ▼                 ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Worker API (worker_api.js)                    │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐ │
│  │/video-event│  │/quiz-submit│  │/tally-hook │  │/leaderboard│ │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬─────┘ │
└────────┼───────────────┼───────────────┼───────────────┼───────┘
         │               │               │               │
         ▼               ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│                         D1 Database                              │
│  video_views │ quiz_attempts │ learners │ badges │ xp_logs      │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Create D1 Database

```bash
# Create database
npx wrangler d1 create lms-db

# Apply schema
npx wrangler d1 execute lms-db --file=schema.sql
```

Update `wrangler.toml` with the database ID returned.

### 2. Deploy Worker API

```bash
cd 04.Execution/lms
npx wrangler deploy
```

### 3. Upload Videos

```bash
python stream_upload.py --file ./video.mp4 --name "SOM 12.01 - Introduction"
```

### 4. Embed Player

```html
<script src="https://embed.cloudflarestream.com/embed/sdk.latest.js"></script>
<stream 
  src="VIDEO_ID" 
  controls 
  data-user-id="user_123"
  data-video-id="VIDEO_ID"
  data-som-id="PA06.2">
</stream>
<script src="/js/player_embed.js"></script>
```

## Files

| File | Description |
|------|-------------|
| `schema.sql` | D1 database schema (all phases) |
| `stream_upload.py` | Upload videos to Cloudflare Stream |
| `player_embed.js` | Frontend event listeners for tracking |
| `worker_api.js` | Cloudflare Worker API |
| `wrangler.toml` | Worker deployment config |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/video-event` | POST | Track video events |
| `/api/quiz-submission` | POST | Submit quiz results |
| `/api/learner?userId=X` | GET | Get learner progress |
| `/api/leaderboard?teamId=X` | GET | Get leaderboard |
| `/api/health` | GET | Health check |

## Environment Variables

Set in `.env` (for Python scripts):
```env
CLOUDFLARE_ACCOUNT_ID=xxx
CLOUDFLARE_STREAM_API_TOKEN=xxx
```

Set via `wrangler secret` (for Worker):
```bash
npx wrangler secret put CLOUDFLARE_STREAM_SIGNING_KEY_ID
npx wrangler secret put CLOUDFLARE_STREAM_SIGNING_KEY_PEM
```

## XP System

| Action | XP |
|--------|-----|
| Video complete | +10 |
| Quiz pass (≥80%) | +50 |
| Perfect quiz (100%) | +25 bonus |
| SOM complete | +100 |
| Streak day | +5 |

## Badges

Default badges are created in `schema.sql`:
- First Video, Video 5, Video 25
- First Quiz, Quiz Master, Perfectionist
- Streak 7, Streak 30
- SOM Complete, Expert (5 SOMs)

