from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class Post(models.Model):
    """
    A community feed post.
    like_count is DENORMALIZED here for fast feed display (avoids COUNT aggregation per post).
    We keep it in sync via the Like signal/save logic.
    """
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='posts')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    like_count = models.PositiveIntegerField(default=0)  # denormalized cache

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Post by {self.author.username} @ {self.created_at}"


class Comment(models.Model):
    """
    Threaded comments using an Adjacency List + Materialized Path strategy.

    WHY THIS APPROACH:
    - Adjacency List (parent FK) is simple and supports unlimited depth.
    - Materialized Path (path field) stores the full ancestor chain as a string
      (e.g., "1.3.7.12") so we can fetch an entire subtree with a single
      LIKE query: WHERE path LIKE '1.3.%'
    - This avoids the classic N+1 problem: we do ONE query to get all comments
      for a post, then reconstruct the tree IN PYTHON using a dict.
      No recursive CTEs needed (SQLite doesn't support them well).
      No 50 queries for 50 comments.

    PATH FORMAT: "<root_comment_id>.<child_id>.<grandchild_id>..."
    The root comment's path is just its own ID: "42"
    A reply to comment 42 with id 55 has path: "42.55"
    """
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='comments')
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='children'
    )
    content = models.TextField()
    path = models.TextField(default='', db_index=True)  # materialized path for subtree queries
    depth = models.PositiveIntegerField(default=0)  # cached depth for UI indentation
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    like_count = models.PositiveIntegerField(default=0)  # denormalized cache

    class Meta:
        ordering = ['created_at']

    def save(self, *args, **kwargs):
        """
        Build the materialized path on first save.
        We need the PK first for root comments, so we do a two-phase save for new roots.
        """
        is_new = self.pk is None

        if is_new:
            if self.parent:
                # Child comment: path = parent.path + "." + own id
                # But we don't have own id yet, so save first, then update path.
                self.depth = self.parent.depth + 1
                super().save(*args, **kwargs)
                self.path = f"{self.parent.path}.{self.pk}"
                # Update path without triggering full save logic again
                Comment.objects.filter(pk=self.pk).update(path=self.path)
                return  # already saved
            else:
                # Root comment: path will be set after we get the PK
                self.depth = 0
                super().save(*args, **kwargs)
                self.path = str(self.pk)
                Comment.objects.filter(pk=self.pk).update(path=self.path)
                return  # already saved

        super().save(*args, **kwargs)

    def __str__(self):
        return f"Comment #{self.pk} by {self.author.username} (depth={self.depth})"


class Like(models.Model):
    """
    Polymorphic like using content_type-style fields manually for simplicity.
    
    CONCURRENCY PROTECTION:
    The (user, target_type, target_id) unique_together constraint is the
    DATABASE-LEVEL lock against double-likes. Even if two requests hit
    simultaneously, the DB will reject the second INSERT with an IntegrityError.
    We catch this in the view and return a proper error response.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='likes')
    target_type = models.CharField(max_length=10, choices=[('post', 'Post'), ('comment', 'Comment')])
    target_id = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'target_type', 'target_id')  # <-- DB-level double-like prevention

    def __str__(self):
        return f"{self.user.username} liked {self.target_type} #{self.target_id}"


class KarmaEvent(models.Model):
    """
    An append-only log of karma transactions.
    
    WHY THIS EXISTS:
    The leaderboard requirement says: "Do not store Daily Karma in a simple
    integer field. Calculate it dynamically from transaction/activity history."
    
    Every time someone earns karma, we create a KarmaEvent.
    The leaderboard query then does:
        SELECT user_id, SUM(amount) 
        FROM karma_event 
        WHERE created_at >= NOW() - 24h 
        GROUP BY user_id 
        ORDER BY SUM(amount) DESC 
        LIMIT 5
    
    This is a proper event-sourced approach. If we ever need "last 7 days"
    or "all time", we just change the WHERE clause — no schema change needed.
    
    KARMA RULES:
    - Like on a Post  = +5 karma for the post AUTHOR
    - Like on a Comment = +1 karma for the comment AUTHOR
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='karma_events')
    amount = models.IntegerField()  # always positive in current logic, but supports negative for future
    reason = models.CharField(max_length=50)  # e.g., "post_like", "comment_like"
    related_type = models.CharField(max_length=10, null=True)  # 'post' or 'comment'
    related_id = models.PositiveIntegerField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} +{self.amount} karma ({self.reason})"
