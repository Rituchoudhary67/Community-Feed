# EXPLAINER.md — Playto Engineering Challenge

## 1. The Tree: How Nested Comments Are Modeled & Serialized

### Database Model: Adjacency List + Materialized Path

The `Comment` model uses a hybrid strategy that combines two classic tree-storage approaches:

**Adjacency List** — each comment has a nullable `parent` foreign key:
```python
parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, related_name='children')
```

This alone is simple but suffers from the N+1 problem: to render a tree, you'd need to query each level recursively (or do N queries for N comments).

**Materialized Path** — a denormalized `path` field stores the full ancestor chain as a dot-separated string:
```python
path = models.TextField(default='', db_index=True)
```

Examples:
- Root comment (id=42): `path = "42"`
- Reply to 42 (id=55): `path = "42.55"`
- Reply to 55 (id=61): `path = "42.55.61"`

The path is constructed automatically in the model's `save()` method:
```python
def save(self, *args, **kwargs):
    is_new = self.pk is None
    if is_new:
        if self.parent:
            self.depth = self.parent.depth + 1
            super().save(*args, **kwargs)  # get PK first
            self.path = f"{self.parent.path}.{self.pk}"
            Comment.objects.filter(pk=self.pk).update(path=self.path)
        else:
            self.depth = 0
            super().save(*args, **kwargs)
            self.path = str(self.pk)
            Comment.objects.filter(pk=self.pk).update(path=self.path)
```

### Why Not Recursive CTEs or Nested Serializers?

- **Recursive CTEs**: SQLite has limited CTE support, and they add complexity. Materialized paths achieve the same result with a simple indexed text field.
- **DRF Nested Serializers**: If you naively nest a `CommentSerializer` inside itself and let DRF resolve `children` via the FK relation, each level triggers a new query. With 50 comments across 5 levels, that's potentially 50 queries.

### The N+1 Solution: Single Query + Python Tree Assembly

In `PostDetailView.get_object()`:

```python
# ONE query — fetches ALL comments for this post
comments_qs = (
    Comment.objects
    .filter(post=post)
    .select_related('author')   # joins auth_user — no per-comment author query
    .order_by('path')           # path ordering = tree traversal order
)

# Build tree in Python — O(n) time, O(n) space
comment_map = {}   # id -> node dict
root_comments = []

for comment in comments_qs:
    node = {
        'id': comment.pk,
        'author_username': comment.author.username,
        'content': comment.content,
        'children': [],
        # ... other fields
    }
    comment_map[comment.pk] = node

    if comment.parent_id is None:
        root_comments.append(node)
    else:
        parent_node = comment_map.get(comment.parent_id)
        if parent_node:
            parent_node['children'].append(node)
```

**Why this works**: Because we ordered by `path`, and the path encodes the ancestor chain, a parent is *always* processed before its children. So when we encounter a child, its parent is already in `comment_map`. This guarantees correct tree assembly in a single pass.

**Total DB queries for a post with 50 nested comments: 2**
1. `SELECT * FROM post WHERE id = X`
2. `SELECT comment.*, auth_user.* FROM comment JOIN auth_user ... WHERE post_id = X ORDER BY path`

Plus one additional query to fetch the current user's liked comment IDs (if authenticated) — still O(1) queries regardless of tree size.

---

## 2. The Math: The "Last 24h Leaderboard" Query

### The Design Constraint

> "Do not store 'Daily Karma' in a simple integer field on the User model. Calculate it dynamically from the transaction/activity history."

### Solution: Append-Only Event Log

Every karma award creates a `KarmaEvent` record:

```python
class KarmaEvent(models.Model):
    user = models.ForeignKey(User)        # who earned karma
    amount = models.IntegerField()        # how much (+5 for post like, +1 for comment like)
    reason = models.CharField()           # 'post_like' or 'comment_like'
    related_type = models.CharField()     # 'post' or 'comment'
    related_id = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)  # the timestamp we filter on
```

### The Leaderboard Query (Django ORM)

```python
from django.utils import timezone
from django.db.models import Sum
from datetime import timedelta

cutoff = timezone.now() - timedelta(hours=24)

leaderboard = (
    KarmaEvent.objects
    .filter(created_at__gte=cutoff)          # only last 24 hours
    .values('user_id', 'user__username')     # GROUP BY these fields
    .annotate(karma=Sum('amount'))           # SUM the karma amounts
    .order_by('-karma')[:5]                  # top 5 only
)
```

### Equivalent Raw SQL

```sql
SELECT
    ke.user_id,
    u.username,
    SUM(ke.amount) AS karma
FROM
    community_karmaevent ke
    INNER JOIN auth_user u ON ke.user_id = u.id
WHERE
    ke.created_at >= datetime('now', '-24 hours')
GROUP BY
    ke.user_id, u.username
ORDER BY
    karma DESC
LIMIT 5;
```

### Why This Approach is Correct

1. **Dynamic**: The query runs fresh every time. Changing the window (e.g., "last 7 days") is a one-line change to the `timedelta`.
2. **Accurate**: No stale cached values. If a like is removed (unlike), the corresponding `KarmaEvent` is deleted, and the next leaderboard query reflects this immediately.
3. **Extensible**: New karma sources (e.g., "post created = +2 karma") just need a new `KarmaEvent` insert — the leaderboard query needs zero changes.
4. **Auditable**: The full history of who earned what and when is preserved. You can answer questions like "who earned the most karma last Tuesday?" without any schema changes.

### Performance Note

For a production system with millions of karma events, you'd add an index on `(created_at, user_id)`. For this prototype's scale, SQLite handles this fine. The query is also naturally bounded: it only scans events from the last 24 hours, not the entire history.

---

## 3. The AI Audit: A Bug I Caught and Fixed

### What AI Generated (the buggy version)

When I initially asked an AI assistant to generate the `LikeToggleView`, it produced this pattern for the "unlike" flow:

```python
# AI-generated (BUGGY)
if existing_like:
    existing_like.delete()
    # Decrement like count
    if target_type == 'post':
        target = Post.objects.get(pk=target_id)
        target.like_count -= 1
        target.save()
    # Delete karma
    KarmaEvent.objects.filter(
        user=target_author, reason=karma_reason
    ).delete()  # ← BUG 1: deletes ALL karma events for this user+reason
    
    return Response({'status': 'unliked'})
```

**Two bugs here:**

**Bug 1 — Overly broad KarmaEvent deletion:**
The filter `user=target_author, reason=karma_reason` would delete *every* karma event of that type for that user — not just the one corresponding to this specific like. If alice had liked 10 posts by bob, and then unliked one, this would wipe out ALL of bob's post-like karma. The fix was to add `related_type` and `related_id` to the filter, and use `.order_by('-created_at')[:1].delete()` to only remove the most recent matching event.

**Bug 2 — Non-atomic like_count decrement:**
The AI used `target.like_count -= 1; target.save()` which is a classic race condition. If two "unlike" requests hit simultaneously:
- Both read `like_count = 5`
- Both write `like_count = 4`
- Result: count is 4, but should be 3

The fix was to use Django's `F()` expression for atomic database-level arithmetic:
```python
# Fixed version — atomic, race-safe
Post.objects.filter(pk=target_id).update(like_count=models.F('like_count') - 1)
```

`F('like_count') - 1` translates to `UPDATE ... SET like_count = like_count - 1` in SQL — the decrement happens in a single atomic operation at the database level, regardless of how many concurrent requests are running.

### The Corrected Code

```python
if existing_like:
    with transaction.atomic():
        existing_like.delete()
        # Atomic decrement — race-safe
        if target_type == 'post':
            Post.objects.filter(pk=target_id).update(like_count=models.F('like_count') - 1)
        else:
            Comment.objects.filter(pk=target_id).update(like_count=models.F('like_count') - 1)
        # Delete only the specific karma event for THIS like
        KarmaEvent.objects.filter(
            user=target_author,
            reason=karma_reason,
            related_type=target_type,
            related_id=target_id,        # ← scoped to this specific target
        ).order_by('-created_at')[:1].delete()  # ← only the most recent one
```

### Lesson

AI assistants are excellent at generating the *structure* of Django views and the general pattern of "check → create → respond." But they consistently miss concurrency subtleties: atomic updates, scoped deletions, and transaction boundaries. These are exactly the kinds of bugs that pass code review if you're not looking for them — they only manifest under concurrent load.
