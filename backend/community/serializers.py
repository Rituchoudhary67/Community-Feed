from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Post, Comment, Like, KarmaEvent


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username']


class CommentSerializer(serializers.Serializer):
    """
    Recursive serializer for the comment tree.
    
    This is called AFTER we've already fetched all comments in a single query
    and reconstructed the tree in Python (see PostDetailView).
    
    Each comment dict already has a 'children' key populated by the view.
    We just serialize the structure here — no additional DB hits.
    """
    id = serializers.IntegerField()
    author = serializers.SerializerMethodField()
    content = serializers.CharField()
    depth = serializers.IntegerField()
    like_count = serializers.IntegerField()
    created_at = serializers.DateTimeField()
    children = serializers.SerializerMethodField()
    parent_id = serializers.IntegerField(allow_null=True)
    is_liked = serializers.BooleanField(default=False)

    def get_author(self, obj):
        # obj is a dict built in the view
        return {'id': obj['author_id'], 'username': obj['author_username']}

    def get_children(self, obj):
        children = obj.get('children', [])
        return CommentSerializer(children, many=True).data


class PostListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for the feed list — no comments loaded."""
    author = UserSerializer(read_only=True)
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = ['id', 'author', 'content', 'like_count', 'created_at', 'is_liked']

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            # This uses a prefetched set if available
            return Like.objects.filter(
                user=request.user, target_type='post', target_id=obj.pk
            ).exists()
        return False


class PostDetailSerializer(serializers.ModelSerializer):
    """
    Full serializer for a single post with its comment tree.
    The 'comments' field is populated manually by the view with the
    reconstructed tree — it's not a standard DRF nested serializer
    that would trigger N+1 queries.
    """
    author = UserSerializer(read_only=True)
    comments = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = ['id', 'author', 'content', 'like_count', 'created_at', 'comments', 'is_liked']

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return Like.objects.filter(
                user=request.user, target_type='post', target_id=obj.pk
            ).exists()
        return False

    def get_comments(self, obj):
        # The view attaches _comment_tree to the post instance
        comment_tree = getattr(obj, '_comment_tree', [])
        return CommentSerializer(comment_tree, many=True).data


class PostCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = ['id', 'content', 'author', 'like_count', 'created_at']
        read_only_fields = ['id', 'author', 'like_count', 'created_at']


class CommentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = ['id', 'content', 'parent', 'post', 'author', 'depth', 'like_count', 'created_at', 'parent_id', 'is_liked']
        read_only_fields = ['id', 'post', 'author', 'depth', 'like_count', 'created_at']

    # Extra fields that don't exist on model but we return
    is_liked = serializers.SerializerMethodField()

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return Like.objects.filter(
                user=request.user, target_type='comment', target_id=obj.pk
            ).exists()
        return False


class LeaderboardSerializer(serializers.Serializer):
    """Serializes the raw aggregation result from the leaderboard query."""
    rank = serializers.IntegerField()
    user_id = serializers.IntegerField()
    username = serializers.CharField()
    karma = serializers.IntegerField()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=4)

    class Meta:
        model = User
        fields = ['id', 'username', 'password']

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user
