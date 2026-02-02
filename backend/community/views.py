from django.db import IntegrityError, transaction
from django.utils import timezone
from django.contrib.auth.models import User
from django.db.models import Sum, Count, Q
from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from datetime import timedelta

from .models import Post, Comment, Like, KarmaEvent
from .serializers import (
    PostListSerializer, PostDetailSerializer, PostCreateSerializer,
    CommentCreateSerializer, LeaderboardSerializer, RegisterSerializer,
    UserSerializer,
)


# ─────────────────────────────────────────────────────────────────────
# AUTH VIEWS
# ─────────────────────────────────────────────────────────────────────

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        # Auto-login after registration
        from django.contrib.auth import login
        login(request, user)
        return Response({'id': user.id, 'username': user.username}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get('username')
    password = request.data.get('password')
    if not username or not password:
        return Response({'error': 'Username and password required'}, status=400)
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response({'error': 'Invalid credentials'}, status=401)
    if not user.check_password(password):
        return Response({'error': 'Invalid credentials'}, status=401)
    from django.contrib.auth import login
    login(request, user)
    return Response({'id': user.id, 'username': user.username})


@api_view(['POST'])
def logout_view(request):
    from django.contrib.auth import logout
    logout(request)
    return Response({'status': 'logged out'})


@api_view(['GET'])
@permission_classes([AllowAny])
def me_view(request):
    if request.user.is_authenticated:
        return Response({'id': request.user.id, 'username': request.user.username, 'authenticated': True})
    return Response({'authenticated': False})


# ─────────────────────────────────────────────────────────────────────
# POST VIEWS
# ─────────────────────────────────────────────────────────────────────

class PostListView(generics.ListCreateAPIView):
    """
    GET  /api/posts/  — Feed listing (paginated, no comments loaded)
    POST /api/posts/  — Create a new post
    """
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return PostCreateSerializer
        return PostListSerializer

    def get_queryset(self):
        return Post.objects.select_related('author').order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class PostDetailView(generics.RetrieveAPIView):
    """
    GET /api/posts/<id>/

    THE N+1 SOLUTION:
    Instead of letting DRF's nested serializer lazily load each comment's
    children (triggering N queries), we:

    1. Fetch the post (1 query)
    2. Fetch ALL comments for this post in ONE query, ordered by path
       (this is the key — ordering by path gives us a predictable tree traversal order)
    3. Reconstruct the tree IN PYTHON using a simple dict lookup
    4. Attach the tree to the post instance
    5. The serializer just walks the pre-built tree — zero additional queries

    Total queries: 2 (one for post, one for all comments)
    Regardless of comment count or nesting depth.
    """
    serializer_class = PostDetailSerializer

    def get_object(self):
        post_id = self.kwargs['pk']
        try:
            post = Post.objects.select_related('author').get(pk=post_id)
        except Post.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound("Post not found")

        # ── SINGLE QUERY: fetch all comments with author info ──
        # select_related('author') prevents N+1 on author lookups
        comments_qs = (
            Comment.objects
            .filter(post=post)
            .select_related('author')
            .order_by('path')  # ordering by materialized path = tree order
        )

        # Build the tree in Python — O(n) time, O(n) space
        # Map: comment_id -> comment_dict (with 'children' list)
        comment_map = {}
        root_comments = []

        # Get liked comment IDs for current user in a single query
        liked_comment_ids = set()
        if self.request.user.is_authenticated:
            liked_comment_ids = set(
                Like.objects.filter(
                    user=self.request.user,
                    target_type='comment',
                    target_id__in=[c.pk for c in comments_qs]
                ).values_list('target_id', flat=True)
            )

        for comment in comments_qs:
            node = {
                'id': comment.pk,
                'author_id': comment.author_id,
                'author_username': comment.author.username,
                'content': comment.content,
                'depth': comment.depth,
                'like_count': comment.like_count,
                'created_at': comment.created_at,
                'parent_id': comment.parent_id,
                'children': [],
                'is_liked': comment.pk in liked_comment_ids,
            }
            comment_map[comment.pk] = node

            if comment.parent_id is None:
                root_comments.append(node)
            else:
                # Attach to parent's children list
                parent_node = comment_map.get(comment.parent_id)
                if parent_node:
                    parent_node['children'].append(node)

        # Attach tree to post for the serializer
        post._comment_tree = root_comments
        return post


class PostCreateView(generics.CreateAPIView):
    serializer_class = PostCreateSerializer

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


# ─────────────────────────────────────────────────────────────────────
# COMMENT VIEWS
# ─────────────────────────────────────────────────────────────────────

class CommentCreateView(generics.CreateAPIView):
    """
    POST /api/posts/<post_id>/comments/

    Body: { "content": "...", "parent": <comment_id or null> }
    """
    serializer_class = CommentCreateSerializer

    def perform_create(self, serializer):
        post_id = self.kwargs['post_id']
        try:
            post = Post.objects.get(pk=post_id)
        except Post.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound("Post not found")

        parent_id = self.request.data.get('parent')
        parent = None
        if parent_id:
            try:
                parent = Comment.objects.get(pk=parent_id, post=post)
            except Comment.DoesNotExist:
                from rest_framework.exceptions import NotFound
                raise NotFound("Parent comment not found")

        serializer.save(
            post=post,
            author=self.request.user,
            parent=parent
        )


# ─────────────────────────────────────────────────────────────────────
# LIKE VIEW — CONCURRENCY SAFE
# ─────────────────────────────────────────────────────────────────────

class LikeToggleView(APIView):
    """
    POST /api/like/
    Body: { "target_type": "post"|"comment", "target_id": <int> }

    TOGGLE behavior: like if not liked, unlike if already liked.

    CONCURRENCY PROTECTION:
    We rely on the database's UNIQUE constraint on (user, target_type, target_id).
    If two requests arrive simultaneously for the same like:
    - Both check "does this like exist?" — both see False (race window)
    - Both try to INSERT
    - The DB rejects the second with IntegrityError (unique violation)
    - We catch it and return "already liked"

    We also wrap the entire operation in a transaction.atomic() block
    so that the like creation + karma event + like_count update are all-or-nothing.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        target_type = request.data.get('target_type')
        target_id = request.data.get('target_id')

        if target_type not in ('post', 'comment'):
            return Response({'error': 'Invalid target_type'}, status=400)
        if not target_id:
            return Response({'error': 'target_id required'}, status=400)

        # Validate target exists
        if target_type == 'post':
            try:
                target = Post.objects.get(pk=target_id)
            except Post.DoesNotExist:
                return Response({'error': 'Post not found'}, status=404)
            karma_amount = 5  # Like on post = 5 karma
            karma_reason = 'post_like'
            target_author = target.author
        else:
            try:
                target = Comment.objects.get(pk=target_id)
            except Comment.DoesNotExist:
                return Response({'error': 'Comment not found'}, status=404)
            karma_amount = 1  # Like on comment = 1 karma
            karma_reason = 'comment_like'
            target_author = target.author

        # Check if already liked (optimistic check before trying insert)
        existing_like = Like.objects.filter(
            user=request.user,
            target_type=target_type,
            target_id=target_id
        ).first()

        if existing_like:
            # UNLIKE: remove like, remove karma, decrement count
            with transaction.atomic():
                existing_like.delete()
                # Remove the corresponding karma event
                KarmaEvent.objects.filter(
                    user=target_author,
                    reason=karma_reason,
                    related_type=target_type,
                    related_id=target_id,
                    # Only delete the most recent one for this like
                ).order_by('-created_at').first()
                # Decrement like_count
                if target_type == 'post':
                    Post.objects.filter(pk=target_id).update(like_count=models.F('like_count') - 1)
                else:
                    Comment.objects.filter(pk=target_id).update(like_count=models.F('like_count') - 1)
                # Delete karma event
                KarmaEvent.objects.filter(
                    user=target_author,
                    reason=karma_reason,
                    related_type=target_type,
                    related_id=target_id,
                ).order_by('-created_at')[:1].delete()

            return Response({
                'status': 'unliked',
                'target_type': target_type,
                'target_id': target_id,
                'is_liked': False,
            })
        else:
            # LIKE: try to create, catch race condition
            try:
                with transaction.atomic():
                    Like.objects.create(
                        user=request.user,
                        target_type=target_type,
                        target_id=target_id,
                    )
                    # Award karma to the TARGET's author (not the liker)
                    # Don't award self-karma
                    if target_author != request.user:
                        KarmaEvent.objects.create(
                            user=target_author,
                            amount=karma_amount,
                            reason=karma_reason,
                            related_type=target_type,
                            related_id=target_id,
                        )
                    # Increment like_count (atomic F() expression is race-safe)
                    if target_type == 'post':
                        Post.objects.filter(pk=target_id).update(like_count=models.F('like_count') + 1)
                    else:
                        Comment.objects.filter(pk=target_id).update(like_count=models.F('like_count') + 1)

            except IntegrityError:
                # Race condition caught! Another request already created this like.
                return Response({
                    'status': 'already_liked',
                    'target_type': target_type,
                    'target_id': target_id,
                    'is_liked': True,
                })

            return Response({
                'status': 'liked',
                'target_type': target_type,
                'target_id': target_id,
                'is_liked': True,
            })


# Need models.F for atomic increment
from django.db import models


# ─────────────────────────────────────────────────────────────────────
# LEADERBOARD VIEW — DYNAMIC 24H AGGREGATION
# ─────────────────────────────────────────────────────────────────────

class LeaderboardView(APIView):
    """
    GET /api/leaderboard/

    DYNAMIC CALCULATION — no cached "daily karma" field.

    We query KarmaEvent directly, filtering to last 24 hours,
    grouping by user, summing karma, ordering descending, limit 5.

    The SQL equivalent:
        SELECT
            ke.user_id,
            u.username,
            SUM(ke.amount) as karma
        FROM community_karmaevent ke
        JOIN auth_user u ON ke.user_id = u.id
        WHERE ke.created_at >= (NOW() - INTERVAL '24 hours')
        GROUP BY ke.user_id, u.username
        ORDER BY karma DESC
        LIMIT 5

    In Django ORM:
        KarmaEvent.objects
            .filter(created_at__gte=cutoff)
            .values('user__username', 'user_id')
            .annotate(karma=Sum('amount'))
            .order_by('-karma')[:5]
    """
    permission_classes = [AllowAny]

    def get(self, request):
        cutoff = timezone.now() - timedelta(hours=24)

        # This is ONE query. Django translates it to the SQL above.
        leaderboard = (
            KarmaEvent.objects
            .filter(created_at__gte=cutoff)
            .values('user_id', 'user__username')
            .annotate(karma=Sum('amount'))
            .order_by('-karma')[:5]
        )

        # Add rank
        results = []
        for rank, entry in enumerate(leaderboard, start=1):
            results.append({
                'rank': rank,
                'user_id': entry['user_id'],
                'username': entry['user__username'],
                'karma': entry['karma'],
            })

        serializer = LeaderboardSerializer(results, many=True)
        return Response(serializer.data)
