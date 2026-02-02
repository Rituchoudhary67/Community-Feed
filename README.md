# Playto Community Feed

A community feed prototype with threaded discussions and a dynamic leaderboard, built with Django + React.

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│                   React SPA                  │
│  (Feed, Post Detail, Comments, Leaderboard)  │
│           Tailwind CSS · Axios               │
└──────────────────┬──────────────────────────┘
                   │ REST API (JSON)
                   ▼
┌─────────────────────────────────────────────┐
│              Django + DRF                    │
│   Auth · Posts · Comments · Likes · Karma   │
└──────────────────┬──────────────────────────┘
                   │ ORM
                   ▼
┌─────────────────────────────────────────────┐
│              SQLite (default)                │
│   Posts · Comments · Likes · KarmaEvents    │
└─────────────────────────────────────────────┘
```

## Key Technical Decisions

| Challenge | Solution |
|-----------|----------|
| **N+1 Comments** | Materialized path on Comment model. Entire comment tree fetched in 1 query, reconstructed in Python. |
| **Double-Like Prevention** | DB-level `UNIQUE(user, target_type, target_id)` constraint catches race conditions via `IntegrityError`. |
| **Leaderboard (24h)** | Append-only `KarmaEvent` log. Leaderboard is a `GROUP BY + SUM` aggregation filtered to last 24h — no cached field. |
| **Concurrency on Like Count** | `F()` expressions for atomic increment/decrement — safe against simultaneous updates. |

## Running Locally

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm

### 1. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create database & tables
python manage.py migrate

# Seed with sample data (users, posts, comments, likes)
python manage.py seed_data

# Start Django dev server
python manage.py runserver
# → http://localhost:8000/api/
```

### 2. Frontend Setup

```bash
cd frontend
npm install

# Set the API base URL for development
# Create .env file or just run (it defaults to /api which proxies via CRA)
npm start
# → http://localhost:3000
```

### 3. Connect Frontend to Backend

Create `frontend/.env`:
```
REACT_APP_API_BASE=http://localhost:8000/api
```

Or, if you prefer, add a proxy to `frontend/package.json`:
```json
"proxy": "http://localhost:8000"
```

Then the React app will automatically proxy `/api/*` to Django.

### Demo Accounts (created by seed_data)

| Username | Password |
|----------|----------|
| alice | password123 |
| bob | password123 |
| charlie | password123 |
| diana | password123 |
| eve | password123 |
| frank | password123 |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register/` | Register new user |
| POST | `/api/auth/login/` | Login |
| POST | `/api/auth/logout/` | Logout |
| GET | `/api/auth/me/` | Current user info |
| GET | `/api/posts/` | List posts (paginated) |
| POST | `/api/posts/` | Create post |
| GET | `/api/posts/:id/` | Get post with comment tree |
| POST | `/api/posts/:id/comments/` | Create comment/reply |
| POST | `/api/like/` | Toggle like (post or comment) |
| GET | `/api/leaderboard/` | Top 5 users by 24h karma |

## Deployment (Railway)

1. Push repo to GitHub
2. Create a Railway project → "Deploy from GitHub repo"
3. Set environment variables:
   - `SECRET_KEY=your-production-secret`
   - `DEBUG=False`
4. Set build command: `bash build.sh`
5. Set start command: `cd backend && gunicorn playto_project.wsgi:application --bind 0.0.0.0:$PORT`

The build script installs Python + Node deps, builds the React app, runs migrations, and seeds data.

## Project Structure

```
playto/
├── backend/
│   ├── playto_project/          # Django project config
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── community/               # Main Django app
│   │   ├── models.py            # Post, Comment, Like, KarmaEvent
│   │   ├── views.py             # All API views
│   │   ├── serializers.py       # DRF serializers
│   │   ├── urls.py              # URL routing
│   │   └── management/commands/
│   │       └── seed_data.py     # Demo data seeder
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/index.js         # Axios API client
│   │   ├── context/
│   │   │   └── AuthContext.js   # Auth state management
│   │   └── components/
│   │       ├── App.js           # Main app + feed
│   │       ├── PostDetail.js    # Single post view
│   │       ├── CommentTree.js   # Recursive comment renderer
│   │       ├── LikeButton.js    # Optimistic like toggle
│   │       ├── Leaderboard.js   # Top 5 widget
│   │       └── AuthModal.js     # Login/Register modal
│   ├── tailwind.config.js
│   └── package.json
├── Procfile                     # Railway/Render start command
├── build.sh                     # CI build script
├── README.md
└── EXPLAINER.md                 # Technical deep-dive
```
# Community-Feed
