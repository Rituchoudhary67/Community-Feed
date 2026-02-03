# Playto Community Feed

A Reddit-style community feed with threaded discussions and a real-time leaderboard. Built with Django + React to solve three critical engineering challenges: N+1 queries, race conditions, and dynamic aggregation.

🔗 **Live Demo**: [Your deployment URL here]

---

## Features

- 📝 Create posts and threaded comments (unlimited nesting)
- ❤️ Like posts and comments
- 🏆 Real-time leaderboard (top 5 users by 24h karma)
- 🔐 User authentication
- ⚡ Optimistic UI updates
- 🎨 Modern, responsive design

---

## Tech Stack

**Backend:**
- Django 4.2 + Django REST Framework
- SQLite (dev) / PostgreSQL (production)
- Session-based authentication

**Frontend:**
- React 18
- Tailwind CSS
- Axios for API calls

---

## Running Locally

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm

### Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Create demo data (optional)
python manage.py seed_data

# Start server
python manage.py runserver
```

Backend runs at: `http://localhost:8000`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

Frontend runs at: `http://localhost:3000`

### Demo Accounts

Login with any of these:

| Username | Password |
|----------|----------|
| alice | password123 |
| bob | password123 |
| charlie | password123 |

---

## Project Structure

```
playto-community/
├── backend/
│   ├── playto_project/      # Django settings
│   ├── community/           # Main app
│   │   ├── models.py        # Post, Comment, Like, KarmaEvent
│   │   ├── views.py         # API endpoints
│   │   ├── serializers.py   # DRF serializers
│   │   └── management/commands/seed_data.py
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── api/            # API client
│   │   └── context/        # Auth context
│   ├── package.json
│   └── tailwind.config.js
├── README.md
└── EXPLAINER.md
```

---

## Key Technical Solutions

### 1. N+1 Query Problem (Comments)
**Challenge**: Loading 50 nested comments shouldn't require 50+ database queries.

**Solution**: Materialized Path pattern
- Each comment stores its full ancestor chain: `"42.55.61"`
- Entire tree fetched in **2 queries** (1 for post, 1 for all comments)
- Tree reconstructed in Python in O(n) time

```python
# Single query for all comments
comments = Comment.objects.filter(post=post).order_by('path')

# Tree assembly in Python
for comment in comments:
    if comment.parent_id is None:
        root_comments.append(comment)
    else:
        parent_node[comment.parent_id]['children'].append(comment)
```

### 2. Race Conditions (Double-Likes)
**Challenge**: Two simultaneous like requests shouldn't create duplicate likes.

**Solution**: Database-level unique constraint
```python
class Like(models.Model):
    class Meta:
        unique_together = ('user', 'target_type', 'target_id')
```

The database rejects duplicate inserts with `IntegrityError`, preventing double-likes even under concurrent load.

### 3. Dynamic Leaderboard (24h Karma)
**Challenge**: Calculate top 5 users by last 24h karma without cached fields.

**Solution**: Event sourcing with aggregate query
```python
cutoff = timezone.now() - timedelta(hours=24)

leaderboard = (
    KarmaEvent.objects
    .filter(created_at__gte=cutoff)
    .values('user_id', 'user__username')
    .annotate(karma=Sum('amount'))
    .order_by('-karma')[:5]
)
```

See `EXPLAINER.md` for detailed technical explanations.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register/` | Register new user |
| POST | `/api/auth/login/` | Login |
| POST | `/api/auth/logout/` | Logout |
| GET | `/api/posts/` | List posts |
| POST | `/api/posts/` | Create post |
| GET | `/api/posts/:id/` | Get post with comments |
| POST | `/api/posts/:id/comments/` | Create comment |
| POST | `/api/like/` | Toggle like |
| GET | `/api/leaderboard/` | Top 5 users (24h) |

---

## Deployment

### Railway (Recommended)

1. Fork this repository
2. Create a Railway account at https://railway.app
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your fork
5. Railway auto-detects Django and deploys automatically
6. Add environment variables:
   - `SECRET_KEY`: Generate with `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`
   - `DEBUG`: `False`
   - `ALLOWED_HOSTS`: Your Railway domain (e.g., `your-app.railway.app`)

The `build.sh` script handles:
- Installing Python + Node dependencies
- Building the React frontend
- Running migrations
- Seeding demo data

### Alternative: Vercel + Railway

**Backend (Railway):**
- Deploy backend folder as separate service
- Add PostgreSQL addon

**Frontend (Vercel):**
- Deploy frontend folder
- Set `REACT_APP_API_BASE` environment variable to your Railway backend URL

---

## Testing the Technical Constraints

### Test N+1 Prevention
```bash
python manage.py shell
```

```python
from community.models import Post, Comment
from django.db import connection, reset_queries

reset_queries()
post = Post.objects.select_related('author').get(pk=1)
comments = Comment.objects.filter(post=post).select_related('author').order_by('path')
list(comments)  # Force query execution

print(f"Queries: {len(connection.queries)}")  # Should be 2
```

### Test Race Condition Protection
Open browser console and run:
```javascript
// Try to like the same post twice simultaneously
Promise.all([
  fetch('/api/like/', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_type: 'post', target_id: 1 })
  }),
  fetch('/api/like/', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_type: 'post', target_id: 1 })
  })
]).then(r => Promise.all(r.map(x => x.json())))
  .then(console.log);
// One returns "liked", other returns "already_liked"
```

### Test Leaderboard Calculation
```bash
python manage.py shell
```

```python
from community.models import KarmaEvent
from django.utils import timezone
from datetime import timedelta
from django.db.models import Sum

cutoff = timezone.now() - timedelta(hours=24)
leaderboard = (
    KarmaEvent.objects
    .filter(created_at__gte=cutoff)
    .values('user_id', 'user__username')
    .annotate(karma=Sum('amount'))
    .order_by('-karma')[:5]
)

print(leaderboard.query)  # See the SQL
print(list(leaderboard))  # See the results
```