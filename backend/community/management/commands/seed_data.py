from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from community.models import Post, Comment, Like, KarmaEvent
from django.utils import timezone
from datetime import timedelta
import random


class Command(BaseCommand):
    help = 'Seed the database with sample data for testing'

    def handle(self, *args, **options):
        self.stdout.write('Seeding database...')

        # Create users
        usernames = ['alice', 'bob', 'charlie', 'diana', 'eve', 'frank']
        users = []
        for name in usernames:
            user, created = User.objects.get_or_create(username=name)
            if created:
                user.set_password('password123')
                user.save()
            users.append(user)

        # Create posts
        post_contents = [
            "Just shipped a new feature that handles 10k concurrent users. The key was using connection pooling + async workers. Happy to share the architecture if anyone's interested! 🚀",
            "Hot take: Most microservices architectures are over-engineered for teams under 50 people. A well-structured monolith with clear module boundaries will serve you better 90% of the time.",
            "Finally cracked the N+1 query problem on our comment system. The trick was materialized paths + single-query tree reconstruction. Will write a blog post about it soon.",
            "Looking for recommendations on observability tools for a Django backend. We're currently using basic logging but need proper distributed tracing as we scale.",
            "Just completed a 60-day coding streak. Here's what I learned about consistency vs. intensity in software engineering — consistency wins every single time.",
            "The future of web development is edge computing. I've been experimenting with deploying ML inference at the edge and the latency improvements are incredible.",
            "Unpopular opinion: TypeScript's type system is becoming more of a hindrance than a help for rapid prototyping. Sometimes you just need to ship.",
            "Built an entire backend API in 4 hours using Django + DRF. The ecosystem is genuinely underrated in 2024. Framework batteries-included philosophy pays off.",
        ]

        posts = []
        for i, content in enumerate(post_contents):
            post = Post.objects.create(
                author=users[i % len(users)],
                content=content,
            )
            posts.append(post)

        # Create comments with nesting
        comment_threads = [
            # Thread on post 0
            {
                'post': posts[0],
                'comments': [
                    {'author': users[1], 'content': "This is exactly what we did at my last company. Connection pooling was the single biggest win.", 'parent': None},
                    {'author': users[2], 'content': "What connection pooling library did you use? We're evaluating PgBouncer vs pgpool-II.", 'parent': 0},
                    {'author': users[1], 'content': "PgBouncer in transaction mode. It's simpler and works great for our use case.", 'parent': 1},
                    {'author': users[3], 'content': "Would love to see that architecture writeup! Especially the async worker setup.", 'parent': None},
                    {'author': users[0], 'content': "Planning to post it next week. The worker setup uses Celery with Redis as broker.", 'parent': 3},
                    {'author': users[4], 'content': "Have you benchmarked against Dramatiq? It's lighter weight than Celery.", 'parent': 4},
                    {'author': users[0], 'content': "Haven't tried Dramatiq yet, adding it to the list!", 'parent': 5},
                    {'author': users[5], 'content': "Great post! The 10k concurrent users benchmark is impressive.", 'parent': None},
                ]
            },
            # Thread on post 1
            {
                'post': posts[1],
                'comments': [
                    {'author': users[0], 'content': "Fully agree. We migrated FROM microservices TO a monolith last year and productivity doubled.", 'parent': None},
                    {'author': users[2], 'content': "Context: this depends heavily on your team structure. Conway's Law and all that.", 'parent': 0},
                    {'author': users[0], 'content': "Absolutely. The law still holds, but most teams misapply it as justification for complexity.", 'parent': 1},
                    {'author': users[3], 'content': "We're a 30-person team and our modular monolith handles everything perfectly. No regrets.", 'parent': None},
                    {'author': users[4], 'content': "What's your deployment strategy for the monolith? Do you use feature flags for gradual rollouts?", 'parent': 3},
                    {'author': users[3], 'content': "Yes! LaunchDarkly for feature flags. Combined with blue-green deployments on Railway.", 'parent': 4},
                ]
            },
            # Thread on post 2
            {
                'post': posts[2],
                'comments': [
                    {'author': users[3], 'content': "Materialized paths are criminally underused. They make recursive queries unnecessary in most cases.", 'parent': None},
                    {'author': users[1], 'content': "The tricky part is keeping paths in sync when comments are deleted. How did you handle that?", 'parent': 0},
                    {'author': users[2], 'content': "Soft deletes are the way to go here. Never actually remove a comment, just mark it as deleted.", 'parent': 1},
                    {'author': users[3], 'content': "Exactly. We use soft deletes and just hide the content in the UI.", 'parent': 2},
                    {'author': users[5], 'content': "This is a great optimization. Would love to see the actual query count comparison.", 'parent': None},
                ]
            },
            # Thread on post 3  
            {
                'post': posts[3],
                'comments': [
                    {'author': users[1], 'content': "We use Datadog. It's expensive but the distributed tracing is excellent for Django.", 'parent': None},
                    {'author': users[4], 'content': "OpenTelemetry + Grafana is a great open-source stack. Much cheaper at scale.", 'parent': 0},
                    {'author': users[1], 'content': "Good point. We're actually evaluating the switch right now.", 'parent': 1},
                    {'author': users[2], 'content': "New Relic has a generous free tier that might work if you're just starting out.", 'parent': None},
                ]
            },
        ]

        all_comments = []
        for thread in comment_threads:
            post = thread['post']
            created_comments = []  # list of (index_in_thread, Comment object)
            for i, c in enumerate(thread['comments']):
                parent = None
                if c['parent'] is not None:
                    # parent index is relative to THIS thread's comments
                    parent = created_comments[c['parent']][1]
                comment = Comment.objects.create(
                    post=post,
                    author=c['author'],
                    content=c['content'],
                    parent=parent,
                )
                created_comments.append((i, comment))
                all_comments.append(comment)

        # Create likes and karma events
        # Like some posts
        like_pairs = [
            (users[1], 'post', posts[0].pk),
            (users[2], 'post', posts[0].pk),
            (users[3], 'post', posts[0].pk),
            (users[4], 'post', posts[0].pk),
            (users[1], 'post', posts[1].pk),
            (users[0], 'post', posts[1].pk),
            (users[3], 'post', posts[1].pk),
            (users[2], 'post', posts[2].pk),
            (users[4], 'post', posts[2].pk),
            (users[5], 'post', posts[2].pk),
            (users[0], 'post', posts[3].pk),
            (users[1], 'post', posts[3].pk),
            (users[2], 'post', posts[3].pk),
            (users[3], 'post', posts[4].pk),
            (users[4], 'post', posts[4].pk),
            (users[5], 'post', posts[5].pk),
            (users[0], 'post', posts[5].pk),
            (users[1], 'post', posts[6].pk),
            (users[2], 'post', posts[7].pk),
            (users[3], 'post', posts[7].pk),
            (users[4], 'post', posts[7].pk),
            (users[5], 'post', posts[7].pk),
        ]

        for user, target_type, target_id in like_pairs:
            like, created = Like.objects.get_or_create(
                user=user, target_type=target_type, target_id=target_id
            )
            if created:
                # Award karma to the post/comment author
                if target_type == 'post':
                    target = Post.objects.get(pk=target_id)
                    Post.objects.filter(pk=target_id).update(like_count=Post.objects.get(pk=target_id).like_count + 1)
                    if target.author != user:
                        KarmaEvent.objects.create(
                            user=target.author,
                            amount=5,
                            reason='post_like',
                            related_type='post',
                            related_id=target_id,
                        )

        # Like some comments  
        comment_likes = []
        for comment in all_comments[:12]:
            # Each comment gets 1-3 random likes from other users
            potential_likers = [u for u in users if u != comment.author]
            num_likes = random.randint(1, 3)
            for liker in random.sample(potential_likers, min(num_likes, len(potential_likers))):
                like, created = Like.objects.get_or_create(
                    user=liker, target_type='comment', target_id=comment.pk
                )
                if created:
                    Comment.objects.filter(pk=comment.pk).update(
                        like_count=Comment.objects.get(pk=comment.pk).like_count + 1
                    )
                    if comment.author != liker:
                        KarmaEvent.objects.create(
                            user=comment.author,
                            amount=1,
                            reason='comment_like',
                            related_type='comment',
                            related_id=comment.pk,
                        )

        # Recompute like counts accurately
        for post in posts:
            post.like_count = Like.objects.filter(target_type='post', target_id=post.pk).count()
            post.save()
        for comment in all_comments:
            comment.like_count = Like.objects.filter(target_type='comment', target_id=comment.pk).count()
            comment.save()

        self.stdout.write(self.style.SUCCESS(f'Successfully seeded: {len(users)} users, {len(posts)} posts, {len(all_comments)} comments'))
