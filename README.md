# LMS Execution Scripts

Learning Management System infrastructure built on Cloudflare (Stream, D1, Workers).

# 0 entropy LMS
Attention, notre LMS est focus 0

Si on regarde skool. LMS hyper minimaliste. Il a pourtant plus de feature que nous.

Mais attention, nous on a un parti pris : l'hyper linéarité. Donc si plein de features de skool sont pas là c'est pour une raison : sur skool on peut glaner dans le cours, faire les modules qui nous intéresse. Nous on force clairement le chemin. Tu peux aller plus vite sur le cours, mais il n'y a qu'une direction et tu ne peux pas revenir en arrière.

L'étudiant doit prendre le LMS exactement comme un cours avec un professeur -> il prend des notes lui-même, n'a pas un cours 2x (ça s'appelle redoubler et c'est painful dans la réalité !). 

La réalité des LMS actuels est qu'ils ont double fonction : LMS et KMS. On regarde un cours, puis on sait que les ressources sont là. Nos cours auront la même tête que les LMS actuels, mais on force la linéarité. Et comme dans un vrai cours à l'école, à la fin ils ont accès aux ressources dans le KMS (l'équivalent d'un polycopié numérique). Voir ils ont d'avances les ressources, peu importe. Tu vois l'idée ? On sépare bien les concerns nous au final

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

